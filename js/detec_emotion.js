import { HolographicTears } from './holographic_tears.js';

export class EmotionController {

    constructor() {

        // =====================================================
        // ESTADO GERAL
        // =====================================================

        this.onEmotionChange = null;

        this.active = false;

        this.video = null;

        this.canvases = {};


        // =====================================================
        // FACE API
        // =====================================================

        this._faceBox = null;

        this._smoothFaceBox = null;

        this._faceSmoothing = 0.75;

        this._landmarks = null;

        this.showLandmarks = false;


        // =====================================================
        // SISTEMA PROCEDURAL DE LÁGRIMAS
        // =====================================================

        this._tears =
            new HolographicTears();


        // =====================================================
        // MODO CARROSSEL
        // =====================================================

        this.carouselMode = false;


        // =====================================================
        // CONTROLE DE DETECÇÃO
        // =====================================================

        this._detectingFace = false;

        this._lastFaceDetectionTime = 0;

        this._faceDetectionInterval = 80;

        this._faceOptions = null;


        // =====================================================
        // ENQUADRAMENTO ESTÁVEL DA CABEÇA
        // =====================================================

        this._headFrame = null;

        this._headFrameInitialized = false;

        this._headFrameWidthFactor = 2.8;

        this._headFrameHeightFactor = 3.4;

        this._headFrameVerticalPosition = 0.56;

        this._headFrameSmoothing = 0.92;


        // =====================================================
        // ESTABILIZAÇÃO TEMPORAL DAS EMOÇÕES
        // =====================================================

        this._lastEmotion = null;

        this._candidateEmotion = null;

        this._candidateEmotionCount = 0;

        this._emotionHistory = [];

        this._emotionHistorySize = 4;


        // =====================================================
        // CONFIGURAÇÃO DAS EMOÇÕES
        // =====================================================

        this._emotionMinConfidence = 0.35;

        this._emotionMinConfidenceByType = {

            sad: 0.22

        };


        // =====================================================
        // FRAMES NECESSÁRIOS PARA CONFIRMAR
        // =====================================================

        this._emotionRequiredFrames = 2;

        this._emotionRequiredFramesByType = {

            sad: 3

        };


        // =====================================================
        // TEMPO MÍNIMO DE PERMANÊNCIA
        // =====================================================

        this._emotionMinimumDuration = 2200;


        // =====================================================
        // TEMPO DE TRANSIÇÃO
        // =====================================================

        this._emotionTransitionDuration = 300;

        this._emotionTransitionDurationByType = {

            sad: 500

        };


        // =====================================================
        // PROTEÇÃO ESPECIAL DO ESTADO NEUTRO
        // =====================================================

        /*
         * O retorno para NEUTRO possui uma proteção maior.
         *
         * Quando uma expressão está ativa e o usuário relaxa
         * o rosto, o face-api pode detectar NEUTRO rapidamente.
         *
         * Para evitar que o holograma volte imediatamente para
         * NEUTRO, exigimos que NEUTRO permaneça como candidata
         * durante 3 segundos.
         *
         * IMPORTANTE:
         *
         * Essa proteção NÃO é aplicada às outras emoções.
         *
         * Portanto:
         *
         * FELIZ -> TRISTE
         * FELIZ -> RAIVA
         * TRISTE -> FELIZ
         * RAIVA -> SURPRESO
         *
         * continuam obedecendo apenas aos tempos normais de
         * estabilização.
         */

        this._neutralExitDelay = 3000;


        // =====================================================
        // MOMENTOS DE CONTROLE
        // =====================================================

        // Momento em que a emoção atual foi confirmada.

        this._emotionStartTime = 0;


        // Momento em que a emoção candidata começou.

        this._candidateStartTime = 0;


        // =====================================================
        // MEDIAPIPE
        // =====================================================

        this._segmentation = null;

        this._segmentationMask = null;

        this._segmentationImage = null;

        this._lastValidMask = null;

        this._lastMaskTime = 0;

        this._segmentationReady = false;

        this._sendingFrame = false;


        // =====================================================
        // CANVAS DA MÁSCARA
        // =====================================================

        this._maskCanvas =
            document.createElement('canvas');

        this._maskCtx =
            this._maskCanvas.getContext('2d');


        // =====================================================
        // CANVAS DA PESSOA
        // =====================================================

        this._personCanvas =
            document.createElement('canvas');

        this._personCtx =
            this._personCanvas.getContext('2d');


        // =====================================================
        // LOOP VISUAL
        // =====================================================

        this._renderLoop();
    }


    // =========================================================
    // INICIALIZA MEDIAPIPE
    // =========================================================

    async _initSegmentation() {

        if (this._segmentation) {
            return;
        }


        if (
            typeof SelfieSegmentation ===
            'undefined'
        ) {

            throw new Error(
                'SelfieSegmentation não foi carregado. ' +
                'Verifique o index.html.'
            );
        }


        console.log(
            'Inicializando MediaPipe Selfie Segmentation...'
        );


        this._segmentation =
            new SelfieSegmentation({

                locateFile: (file) => {

                    return (
                        'https://cdn.jsdelivr.net/npm/' +
                        '@mediapipe/selfie_segmentation@0.1/' +
                        file
                    );
                }

            });


        this._segmentation.setOptions({

            modelSelection: 1

        });


        this._segmentation.onResults(
            (results) => {

                if (
                    !results ||
                    !results.segmentationMask
                ) {

                    return;
                }


                this._segmentationMask =
                    results.segmentationMask;


                this._segmentationImage =
                    results.image;


                this._lastValidMask =
                    results.segmentationMask;


                this._lastMaskTime =
                    performance.now();


                this._segmentationReady =
                    true;
            }
        );


        console.log(
            'MediaPipe Selfie Segmentation inicializado.'
        );
    }


    // =========================================================
    // INICIA DETECÇÃO
    // =========================================================

    async startDetection(
        stream,
        existingVideo = null
    ) {

        if (this.active) {

            console.warn(
                'Detecção já estava ativa.'
            );

            return;
        }


        // =====================================================
        // USA O VÍDEO EXISTENTE
        // =====================================================

        if (existingVideo) {

            this.video =
                existingVideo;

        } else {

            this.video =
                document.createElement('video');


            this.video.srcObject =
                stream;


            this.video.muted =
                true;


            this.video.autoplay =
                true;


            this.video.playsInline =
                true;


            await this.video.play();
        }


        // =====================================================
        // ESPERA A CÂMERA ESTAR PRONTA
        // =====================================================

        await this._waitForVideo();


        const width =
            this.video.videoWidth;


        const height =
            this.video.videoHeight;


        console.log(
            `Câmera pronta: ${width}x${height}`
        );


        // =====================================================
        // CONFIGURA CANVAS
        // =====================================================

        this._maskCanvas.width =
            width;


        this._maskCanvas.height =
            height;


        this._personCanvas.width =
            width;


        this._personCanvas.height =
            height;


        // =====================================================
        // VERIFICA FACE API
        // =====================================================

        if (
            typeof faceapi ===
            'undefined'
        ) {

            throw new Error(
                'face-api.js não foi carregado.'
            );
        }


        // =====================================================
        // CONFIGURA DETECTOR FACIAL
        // =====================================================

        this._faceOptions =
            new faceapi.TinyFaceDetectorOptions({

                inputSize: 416,

                scoreThreshold: 0.20

            });


        // =====================================================
        // MEDIAPIPE
        // =====================================================

        await this._initSegmentation();


        // =====================================================
        // LIMPA ESTADOS ANTERIORES
        // =====================================================

        this._segmentationMask =
            null;


        this._segmentationImage =
            null;


        this._lastValidMask =
            null;


        this._segmentationReady =
            false;


        this._smoothFaceBox =
            null;


        this._faceBox =
            null;


        this._landmarks =
            null;


        this._headFrame =
            null;


        this._headFrameInitialized =
            false;


        // =====================================================
        // RESET EMOÇÕES
        // =====================================================

        this._emotionHistory =
            [];


        this._lastEmotion =
            null;


        this._candidateEmotion =
            null;


        this._candidateEmotionCount =
            0;


        this._emotionStartTime =
            0;


        this._candidateStartTime =
            0;


        this._lastFaceDetectionTime =
            0;


        // =====================================================
        // ATIVA
        // =====================================================

        this.active =
            true;


        console.log(
            'EmotionController ativo.'
        );


        // =====================================================
        // INICIA PROCESSAMENTOS
        // =====================================================

        this._segmentationLoop();

        this._faceLoop();
    }


    // =========================================================
    // ESPERA O VÍDEO
    // =========================================================

    async _waitForVideo() {

        if (
            this.video &&
            this.video.videoWidth > 0 &&
            this.video.videoHeight > 0
        ) {

            return;
        }


        await new Promise(
            (resolve) => {

                const check =
                    () => {

                        if (!this.video) {

                            requestAnimationFrame(
                                check
                            );

                            return;
                        }


                        if (
                            this.video.videoWidth > 0 &&
                            this.video.videoHeight > 0
                        ) {

                            resolve();

                            return;
                        }


                        requestAnimationFrame(
                            check
                        );
                    };


                check();
            }
        );
    }


    // =========================================================
    // LOOP MEDIAPIPE
    // =========================================================

    async _segmentationLoop() {

        if (!this.active) {
            return;
        }


        if (
            this.video &&
            this.video.readyState >= 2 &&
            this._segmentation &&
            !this._sendingFrame
        ) {

            this._sendingFrame =
                true;


            try {

                await this._segmentation.send({

                    image: this.video

                });

            } catch (error) {

                console.error(
                    'Erro no MediaPipe:',
                    error
                );

            } finally {

                this._sendingFrame =
                    false;
            }
        }


        requestAnimationFrame(
            () =>
                this._segmentationLoop()
        );
    }


    // =========================================================
    // LOOP FACE API
    // =========================================================

    _faceLoop() {

        if (!this.active) {
            return;
        }


        const now =
            performance.now();


        if (
            now -
            this._lastFaceDetectionTime
            >=
            this._faceDetectionInterval
        ) {

            this._lastFaceDetectionTime =
                now;


            this._detectFace();
        }


        requestAnimationFrame(
            () =>
                this._faceLoop()
        );
    }


    // =========================================================
    // DETECÇÃO FACIAL
    // =========================================================

    async _detectFace() {

        if (
            !this.video ||
            !this.active ||
            this._detectingFace
        ) {

            return;
        }


        if (
            this.video.readyState < 2
        ) {

            return;
        }


        this._detectingFace =
            true;


        try {

            let detection =
                null;


            // =================================================
            // DETECÇÃO FACIAL
            // =================================================

            detection =
                await faceapi
                    .detectSingleFace(
                        this.video,
                        this._faceOptions
                    )
                    .withFaceLandmarks(true)
                    .withFaceExpressions();


            // =================================================
            // GUARDA LANDMARKS
            // =================================================

            this._landmarks =
                detection?.landmarks ||
                null;


            // =================================================
            // ROSTO ENCONTRADO
            // =================================================

            if (detection) {

                const newBox =
                    detection.detection.box;


                // =============================================
                // PRIMEIRA DETECÇÃO
                // =============================================

                if (
                    !this._smoothFaceBox
                ) {

                    this._smoothFaceBox = {

                        x: newBox.x,

                        y: newBox.y,

                        width: newBox.width,

                        height: newBox.height

                    };

                }


                // =============================================
                // SUAVIZA O ROSTO
                // =============================================

                else {

                    const s =
                        this._faceSmoothing;


                    this._smoothFaceBox.x =
                        this._smoothFaceBox.x * s +
                        newBox.x * (1 - s);


                    this._smoothFaceBox.y =
                        this._smoothFaceBox.y * s +
                        newBox.y * (1 - s);


                    this._smoothFaceBox.width =
                        this._smoothFaceBox.width * s +
                        newBox.width * (1 - s);


                    this._smoothFaceBox.height =
                        this._smoothFaceBox.height * s +
                        newBox.height * (1 - s);
                }


                this._faceBox = {

                    ...this._smoothFaceBox

                };


                // =============================================
                // ATUALIZA ENQUADRAMENTO
                // =============================================

                this._updateHeadFrame();


                // =============================================
                // PROCESSA EMOÇÃO
                // =============================================

                if (
                    detection.expressions
                ) {

                    this._processEmotion(
                        detection.expressions
                    );
                }
            }

        } catch (error) {

            console.error(
                'Erro face-api:',
                error
            );

        } finally {

            this._detectingFace =
                false;
        }
    }


    // =========================================================
    // ATUALIZA ENQUADRAMENTO DA CABEÇA
    // =========================================================

    _updateHeadFrame() {

        if (
            !this._faceBox ||
            !this.video
        ) {

            return;
        }


        const videoW =
            this.video.videoWidth;


        const videoH =
            this.video.videoHeight;


        if (
            !videoW ||
            !videoH
        ) {

            return;
        }


        const face =
            this._faceBox;


        // =====================================================
        // PRIMEIRA DETECÇÃO
        // =====================================================

        if (
            !this._headFrameInitialized
        ) {

            const frameWidth =
                face.width *
                this._headFrameWidthFactor;


            const frameHeight =
                face.height *
                this._headFrameHeightFactor;


            const centerX =
                face.x +
                face.width / 2;


            const centerY =
                face.y +
                face.height * 0.45;


            this._headFrame = {

                x:
                    centerX -
                    frameWidth / 2,

                y:
                    centerY -
                    frameHeight *
                    this._headFrameVerticalPosition,

                width:
                    frameWidth,

                height:
                    frameHeight
            };


            this._headFrameInitialized =
                true;


            this._clampHeadFrame();


            return;
        }


        // =====================================================
        // ENQUADRAMENTO JÁ EXISTE
        // =====================================================

        const frame =
            this._headFrame;


        const centerX =
            face.x +
            face.width / 2;


        const centerY =
            face.y +
            face.height * 0.45;


        const targetX =
            centerX -
            frame.width / 2;


        const targetY =
            centerY -
            frame.height *
            this._headFrameVerticalPosition;


        const s =
            this._headFrameSmoothing;


        frame.x =
            frame.x * s +
            targetX * (1 - s);


        frame.y =
            frame.y * s +
            targetY * (1 - s);


        this._clampHeadFrame();
    }


    // =========================================================
    // LIMITA ENQUADRAMENTO À CÂMERA
    // =========================================================

    _clampHeadFrame() {

        if (
            !this._headFrame ||
            !this.video
        ) {

            return;
        }


        const videoW =
            this.video.videoWidth;


        const videoH =
            this.video.videoHeight;


        const frame =
            this._headFrame;


        // =====================================================
        // HORIZONTAL
        // =====================================================

        if (
            frame.width >= videoW
        ) {

            frame.x =
                0;

            frame.width =
                videoW;

        } else {

            frame.x =
                Math.max(
                    0,
                    Math.min(
                        frame.x,
                        videoW -
                        frame.width
                    )
                );
        }


        // =====================================================
        // VERTICAL
        // =====================================================

        if (
            frame.height >= videoH
        ) {

            frame.y =
                0;

            frame.height =
                videoH;

        } else {

            frame.y =
                Math.max(
                    0,
                    Math.min(
                        frame.y,
                        videoH -
                        frame.height
                    )
                );
        }
    }


    // =========================================================
    // OBTÉM CONFIGURAÇÃO DA EMOÇÃO
    // =========================================================

    _getEmotionMinConfidence(
        emotion
    ) {

        if (
            this._emotionMinConfidenceByType &&
            this._emotionMinConfidenceByType[
                emotion
            ] !== undefined
        ) {

            return (
                this._emotionMinConfidenceByType[
                    emotion
                ]
            );
        }


        return this._emotionMinConfidence;
    }


    // =========================================================
    // OBTÉM FRAMES NECESSÁRIOS
    // =========================================================

    _getEmotionRequiredFrames(
        emotion
    ) {

        if (
            this._emotionRequiredFramesByType &&
            this._emotionRequiredFramesByType[
                emotion
            ] !== undefined
        ) {

            return (
                this._emotionRequiredFramesByType[
                    emotion
                ]
            );
        }


        return this._emotionRequiredFrames;
    }


    // =========================================================
    // OBTÉM TEMPO DE TRANSIÇÃO
    // =========================================================

    _getEmotionTransitionDuration(
        emotion
    ) {

        if (
            this._emotionTransitionDurationByType &&
            this._emotionTransitionDurationByType[
                emotion
            ] !== undefined
        ) {

            return (
                this._emotionTransitionDurationByType[
                    emotion
                ]
            );
        }


        return this._emotionTransitionDuration;
    }


    // =========================================================
    // PROCESSA EMOÇÃO
    // =========================================================

    _processEmotion(expressions) {

        if (!expressions) {
            return;
        }


        // =====================================================
        // ENCONTRA EMOÇÃO MAIS PROVÁVEL
        // =====================================================

        let detectedEmotion =
            'neutral';


        let detectedConfidence =
            0;


        for (
            const [name, value]
            of Object.entries(expressions)
        ) {

            if (
                value >
                detectedConfidence
            ) {

                detectedConfidence =
                    value;

                detectedEmotion =
                    name;
            }
        }


        // =====================================================
        // CONFIDÊNCIA MÍNIMA ESPECÍFICA
        // =====================================================

        const minimumConfidence =
            this._getEmotionMinConfidence(
                detectedEmotion
            );


        if (
            detectedConfidence <
            minimumConfidence
        ) {

            return;
        }


        const now =
            performance.now();


        // =====================================================
        // GUARDA NO HISTÓRICO
        // =====================================================

        this._emotionHistory.push({

            emotion:
                detectedEmotion,

            confidence:
                detectedConfidence,

            time:
                now

        });


        if (
            this._emotionHistory.length >
            this._emotionHistorySize
        ) {

            this._emotionHistory.shift();
        }


        // =====================================================
        // ENCONTRA EMOÇÃO DOMINANTE
        // =====================================================

        const counts =
            {};


        for (
            const item
            of this._emotionHistory
        ) {

            counts[item.emotion] =
                (counts[item.emotion] || 0) +
                1;
        }


        let dominantEmotion =
            detectedEmotion;


        let dominantCount =
            0;


        for (
            const [emotion, count]
            of Object.entries(counts)
        ) {

            if (
                count >
                dominantCount
            ) {

                dominantEmotion =
                    emotion;

                dominantCount =
                    count;
            }
        }


        // =====================================================
        // CONFIANÇA MÉDIA
        // =====================================================

        let confidenceSum =
            0;


        let confidenceCount =
            0;


        for (
            const item
            of this._emotionHistory
        ) {

            if (
                item.emotion ===
                dominantEmotion
            ) {

                confidenceSum +=
                    item.confidence;

                confidenceCount++;
            }
        }


        const averageConfidence =
            confidenceCount > 0
                ? confidenceSum /
                  confidenceCount
                : detectedConfidence;


        // =====================================================
        // PRIMEIRA EMOÇÃO
        // =====================================================

        if (
            this._lastEmotion === null
        ) {

            if (
                this._candidateEmotion !==
                dominantEmotion
            ) {

                this._candidateEmotion =
                    dominantEmotion;

                this._candidateEmotionCount =
                    1;

                this._candidateStartTime =
                    now;

                return;
            }


            this._candidateEmotionCount++;


            const candidateDuration =
                now -
                this._candidateStartTime;


            const requiredFrames =
                this._getEmotionRequiredFrames(
                    dominantEmotion
                );


            const transitionDuration =
                this._getEmotionTransitionDuration(
                    dominantEmotion
                );


            if (
                this._candidateEmotionCount >=
                    requiredFrames &&
                candidateDuration >=
                    transitionDuration
            ) {

                this._confirmEmotion(
                    dominantEmotion,
                    averageConfidence,
                    now
                );
            }


            return;
        }


        // =====================================================
        // MESMA EMOÇÃO ATUAL
        // =====================================================

        if (
            dominantEmotion ===
            this._lastEmotion
        ) {

            /*
             * A emoção atual voltou a ser dominante.
             *
             * Portanto cancelamos imediatamente a candidata.
             * Isso evita que uma pequena oscilação do
             * face-api.js provoque uma mudança.
             */

            this._candidateEmotion =
                null;


            this._candidateEmotionCount =
                0;


            this._candidateStartTime =
                0;


            return;
        }


        // =====================================================
        // NOVA EMOÇÃO APARECEU
        // =====================================================

        if (
            this._candidateEmotion !==
            dominantEmotion
        ) {

            this._candidateEmotion =
                dominantEmotion;


            this._candidateEmotionCount =
                1;


            this._candidateStartTime =
                now;


            console.log(
                'Nova emoção candidata:',
                dominantEmotion
            );


            return;
        }


        // =====================================================
        // CANDIDATA CONTINUA PRESENTE
        // =====================================================

        this._candidateEmotionCount++;


        const candidateDuration =
            now -
            this._candidateStartTime;


        // =====================================================
        // PROTEÇÃO DA EMOÇÃO ATUAL
        // =====================================================

        const currentEmotionDuration =
            now -
            this._emotionStartTime;


        if (
            currentEmotionDuration <
            this._emotionMinimumDuration
        ) {

            return;
        }


        // =====================================================
        // PROTEÇÃO ESPECIAL — SOMENTE PARA NEUTRO
        // =====================================================

        /*
         * IMPORTANTE:
         *
         * Os 3 segundos são aplicados SOMENTE quando a nova
         * emoção candidata é NEUTRO.
         *
         * Assim:
         *
         * FELIZ -> NEUTRO
         * TRISTE -> NEUTRO
         * RAIVA -> NEUTRO
         *
         * precisam de 3 segundos de estabilidade.
         *
         * Já:
         *
         * FELIZ -> TRISTE
         * FELIZ -> RAIVA
         * TRISTE -> FELIZ
         * RAIVA -> SURPRESO
         *
         * continuam usando apenas o tempo normal de
         * transição.
         */

        if (
            dominantEmotion === 'neutral' &&
            candidateDuration <
            this._neutralExitDelay
        ) {

            return;
        }


        // =====================================================
        // CONFIGURAÇÃO ESPECÍFICA
        // =====================================================

        const requiredFrames =
            this._getEmotionRequiredFrames(
                dominantEmotion
            );


        const transitionDuration =
            this._getEmotionTransitionDuration(
                dominantEmotion
            );


        // =====================================================
        // TEMPO DE TRANSIÇÃO
        // =====================================================

        if (
            candidateDuration <
            transitionDuration
        ) {

            return;
        }


        // =====================================================
        // FRAMES SUFICIENTES
        // =====================================================

        if (
            this._candidateEmotionCount <
            requiredFrames
        ) {

            return;
        }


        // =====================================================
        // CONFIRMA NOVA EMOÇÃO
        // =====================================================

        this._confirmEmotion(
            dominantEmotion,
            averageConfidence,
            now
        );
    }


    // =========================================================
    // CONFIRMA EMOÇÃO
    // =========================================================

    _confirmEmotion(
        emotion,
        confidence,
        now
    ) {

        // =====================================================
        // ATUALIZA ESTADO
        // =====================================================

        this._lastEmotion =
            emotion;


        this._emotionStartTime =
            now;


        // =====================================================
        // LIMPA CANDIDATA
        // =====================================================

        this._candidateEmotion =
            null;


        this._candidateEmotionCount =
            0;


        this._candidateStartTime =
            0;


        console.log(
            'Emoção estabilizada:',
            emotion,
            'confiança:',
            confidence.toFixed(2)
        );


        // =====================================================
        // ATUALIZA SISTEMA DE LÁGRIMAS
        // =====================================================

        if (
            this._tears
        ) {

            this._tears.setEmotion(
                emotion,
                confidence
            );
        }


        // =====================================================
        // ENVIA PARA O SISTEMA PRINCIPAL
        // =====================================================

        if (
            this.onEmotionChange
        ) {

            this.onEmotionChange(

                emotion,

                confidence

            );
        }
    }


    // =========================================================
    // LOOP VISUAL
    // =========================================================

    _renderLoop() {

        this._drawAll();


        requestAnimationFrame(
            () =>
                this._renderLoop()
        );
    }


    // =========================================================
    // REGISTRA CANVAS
    // =========================================================

    registerCanvas(
        id,
        canvas,
        videoEl
    ) {

        if (!canvas) {
            return;
        }


        const ctx =
            canvas.getContext('2d');


        if (!ctx) {
            return;
        }


        this.canvases[id] = {

            canvas,

            videoEl,

            ctx

        };
    }


    // =========================================================
    // DESENHA TODOS OS CANVASES
    // =========================================================

    _drawAll() {

        if (!this.video) {
            return;
        }


        if (
            this.video.readyState < 2 ||
            !this.video.videoWidth
        ) {

            return;
        }


        for (
            const item
            of Object.values(
                this.canvases
            )
        ) {

            const {
                canvas,
                ctx
            } = item;


            if (
                !canvas ||
                !ctx
            ) {

                continue;
            }


            const w =
                canvas.width;


            const h =
                canvas.height;


            if (
                w <= 0 ||
                h <= 0
            ) {

                continue;
            }


            // =================================================
            // FUNDO PRETO
            // =================================================

            ctx.save();


            ctx.globalCompositeOperation =
                'source-over';


            ctx.fillStyle =
                '#000000';


            ctx.fillRect(
                0,
                0,
                w,
                h
            );


            // =================================================
            // AGUARDA MÁSCARA
            // =================================================

            if (
                !this._segmentationReady
            ) {

                ctx.restore();

                continue;
            }


            // =================================================
            // USA MÁSCARA ATUAL
            // =================================================

            const mask =
                this._segmentationMask ||
                this._lastValidMask;


            if (!mask) {

                ctx.restore();

                continue;
            }


            // =================================================
            // DESENHA CABEÇA SEGMENTADA
            // =================================================

            this._drawHeadSegmented(

                ctx,

                w,

                h,

                mask

            );


            ctx.restore();
        }
    }


    // =========================================================
    // DESENHA SOMENTE A CABEÇA SEGMENTADA
    // =========================================================

    _drawHeadSegmented(
        ctx,
        outputW,
        outputH,
        segmentationMask
    ) {

        const videoW =
            this.video.videoWidth;


        const videoH =
            this.video.videoHeight;


        if (
            !videoW ||
            !videoH
        ) {

            return;
        }


        // =====================================================
        // AGUARDA DETECÇÃO FACIAL
        // =====================================================

        if (
            !this._faceBox ||
            !this._headFrame
        ) {

            return;
        }


        const frame =
            this._headFrame;


        if (
            frame.width <= 0 ||
            frame.height <= 0
        ) {

            return;
        }


        // =====================================================
        // COPIA MÁSCARA MEDIAPIPE
        // =====================================================

        const maskCtx =
            this._maskCtx;


        maskCtx.clearRect(
            0,
            0,
            videoW,
            videoH
        );


        maskCtx.globalCompositeOperation =
            'source-over';


        maskCtx.drawImage(

            segmentationMask,

            0,
            0,
            videoW,
            videoH

        );


        // =====================================================
        // COPIA IMAGEM DA CÂMERA
        // =====================================================

        const personCtx =
            this._personCtx;


        personCtx.clearRect(
            0,
            0,
            videoW,
            videoH
        );


        personCtx.globalCompositeOperation =
            'source-over';


        personCtx.drawImage(

            this.video,

            0,
            0,
            videoW,
            videoH

        );


        // =====================================================
        // APLICA SEGMENTAÇÃO
        // =====================================================

        personCtx.globalCompositeOperation =
            'destination-in';


        personCtx.drawImage(

            this._maskCanvas,

            0,
            0

        );


        // =====================================================
        // LIMITA À JANELA DA CABEÇA
        // =====================================================

        personCtx.globalCompositeOperation =
            'destination-in';


        personCtx.fillStyle =
            '#ffffff';


        personCtx.fillRect(

            frame.x,

            frame.y,

            frame.width,

            frame.height

        );


        // =====================================================
        // MANTÉM PROPORÇÃO
        // =====================================================

        const sourceAspect =
            frame.width /
            frame.height;


        const outputAspect =
            outputW /
            outputH;


        let drawWidth =
            outputW;


        let drawHeight =
            outputH;


        let drawX =
            0;


        let drawY =
            0;


        if (
            sourceAspect >
            outputAspect
        ) {

            drawHeight =
                outputH;


            drawWidth =
                outputH *
                sourceAspect;


            drawX =
                (
                    outputW -
                    drawWidth
                ) / 2;

        } else {

            drawWidth =
                outputW;


            drawHeight =
                outputW /
                sourceAspect;


            drawY =
                (
                    outputH -
                    drawHeight
                ) / 2;
        }


        // =====================================================
        // DESENHA NO HOLOGRAMA
        // =====================================================

        ctx.drawImage(

            this._personCanvas,

            frame.x,
            frame.y,
            frame.width,
            frame.height,

            drawX,
            drawY,
            drawWidth,
            drawHeight

        );


        // =====================================================
        // LÁGRIMAS HOLOGRÁFICAS
        // =====================================================

        if (
            this._landmarks &&
            this._tears
        ) {

            const scaleX =
                drawWidth /
                frame.width;


            const scaleY =
                drawHeight /
                frame.height;


            this._tears.draw(

                ctx,

                this._landmarks.positions,

                {

                    frameX:
                        frame.x,

                    frameY:
                        frame.y,

                    drawX:
                        drawX,

                    drawY:
                        drawY,

                    scaleX:
                        scaleX,

                    scaleY:
                        scaleY,

                    scale:
                        (
                            scaleX +
                            scaleY
                        ) / 2

                }

            );
        }
    }


    // =========================================================
    // CONTROLES
    // =========================================================

    setLandmarksVisible(
        visible
    ) {

        this.showLandmarks =
            Boolean(visible);
    }


    setCarouselMode(
        enabled
    ) {

        this.carouselMode =
            Boolean(enabled);
    }


    // =========================================================
    // PARA DETECÇÃO
    // =========================================================

    stop() {

        this.active =
            false;


        this._sendingFrame =
            false;


        this._detectingFace =
            false;


        this._segmentationMask =
            null;


        this._lastValidMask =
            null;


        this._segmentationReady =
            false;


        this._faceBox =
            null;


        this._smoothFaceBox =
            null;


        this._landmarks =
            null;


        this._headFrame =
            null;


        this._headFrameInitialized =
            false;


        // =====================================================
        // RESET EMOÇÕES
        // =====================================================

        this._emotionHistory =
            [];


        this._lastEmotion =
            null;


        this._candidateEmotion =
            null;


        this._candidateEmotionCount =
            0;


        this._emotionStartTime =
            0;


        this._candidateStartTime =
            0;


        console.log(
            'EmotionController parado.'
        );
    }
}
