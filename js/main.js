const CONFIG = {
    MODELS:
        'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
};


// ============================================================
// ÁUDIO
// ============================================================

const AUDIO_MAP = {

    happy:
        'assets/audio/Holograma3D_Feliz.mp3',

    sad:
        'assets/audio/Holograma3D_Triste.mp3',

    angry:
        'assets/audio/Holograma3D_Raiva.mp3',

    disgusted:
        'assets/audio/Holograma3D_Nojo.mp3',

    surprised:
        'assets/audio/Holograma3D_Surpresa.mp3',

    fearful:
        'assets/audio/Holograma3D_Triste.mp3',

    neutral:
        'assets/audio/Holograma3D_Neutro.mp3',

    /*
     * Mantido no mapa por compatibilidade,
     * mas NÃO é usado como trilha principal
     * do carrossel.
     *
     * No carrossel, o áudio é determinado
     * pela emoção que está em videoTop.
     */
    carousel:
        'assets/audio/Holograma3D_Carrossel.mp3'
};


const FADE_DURATION = 1000;

const FACE_IDS = [
    'videoTop',
    'videoLeft',
    'videoRight',
    'videoBottom'
];


// ============================================================
// ESTADO GLOBAL
// ============================================================

let hCtrl = null;
let eCtrl = null;

let carouselActive = false;
let landmarksActive = false;

let currentAudio = null;
let currentEmotion = null;

/*
 * Geração do sistema de áudio.
 *
 * Cada troca de áudio invalida os fades anteriores.
 * Isso impede que vários requestAnimationFrame()
 * antigos continuem alterando o volume do áudio atual.
 */
let audioGeneration = 0;

let systemStarted = false;
let startInProgress = false;

let cameraStream = null;
let hiddenVideo = null;


// ============================================================
// UTILITÁRIOS DE ÁUDIO
// ============================================================

function clampVolume(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(1, number)
    );
}


function setAudioVolume(audio, value) {

    if (!audio) {
        return;
    }

    try {

        audio.volume =
            clampVolume(value);

    } catch (error) {

        console.warn(
            'Não foi possível ajustar volume:',
            error
        );
    }
}


function invalidateAudioFades() {

    audioGeneration++;

    return audioGeneration;
}


// ============================================================
// INIT
// ============================================================

async function init() {

    try {

        const progress =
            document.getElementById(
                'loadingProgress'
            );


        // ====================================================
        // TINY FACE DETECTOR
        // ====================================================

        console.log(
            'Carregando TinyFaceDetector...'
        );

        await faceapi.nets
            .tinyFaceDetector
            .loadFromUri(
                CONFIG.MODELS
            );


        if (progress) {
            progress.style.width =
                '33%';
        }

        console.log(
            'TinyFaceDetector carregado.'
        );


        // ====================================================
        // EXPRESSÕES
        // ====================================================

        console.log(
            'Carregando FaceExpressionNet...'
        );

        await faceapi.nets
            .faceExpressionNet
            .loadFromUri(
                CONFIG.MODELS
            );


        if (progress) {
            progress.style.width =
                '66%';
        }

        console.log(
            'FaceExpressionNet carregado.'
        );


        // ====================================================
        // LANDMARKS
        // ====================================================

        console.log(
            'Carregando FaceLandmark68TinyNet...'
        );

        await faceapi.nets
            .faceLandmark68TinyNet
            .loadFromUri(
                CONFIG.MODELS
            );


        if (progress) {
            progress.style.width =
                '100%';
        }

        console.log(
            'FaceLandmark68TinyNet carregado.'
        );


        // ====================================================
        // CÂMERAS
        // ====================================================

        const devices =
            await navigator
                .mediaDevices
                .enumerateDevices();


        const videos =
            devices.filter(
                device =>
                    device.kind ===
                    'videoinput'
            );


        const select =
            document.getElementById(
                'cameraSelect'
            );


        if (select) {

            select.innerHTML =
                videos.map(
                    device =>
                        `<option value="${device.deviceId}">
                            ${device.label || 'Câmera'}
                        </option>`
                ).join('');


            select.disabled = false;
        }


        const startBtn =
            document.getElementById(
                'startBtn'
            );


        if (startBtn) {
            startBtn.disabled = false;
        }


        const loadingScreen =
            document.getElementById(
                'loadingScreen'
            );


        if (loadingScreen) {
            loadingScreen.style.display =
                'none';
        }


        updateStatus(
            'Pronto para iniciar',
            'success'
        );


        console.log(
            'Inicialização concluída.'
        );


    } catch (error) {

        console.error(
            'Erro ao carregar modelos:',
            error
        );


        updateStatus(
            'Erro ao carregar modelos',
            'danger'
        );
    }
}


// ============================================================
// START
// ============================================================

async function start() {

    /*
     * Evita clicar em START várias vezes.
     */
    if (startInProgress) {

        console.log(
            'Inicialização já está em andamento.'
        );

        return;
    }


    /*
     * Se o sistema já está funcionando,
     * não cria outra câmera nem tenta recriar
     * os canvases.
     */
    if (
        systemStarted &&
        eCtrl &&
        hCtrl
    ) {

        console.log(
            'Holograma já está em execução. START ignorado.'
        );

        updateStatus(
            'Holograma Online',
            'success'
        );

        return;
    }


    startInProgress = true;


    try {

        // ====================================================
        // BOTÃO
        // ====================================================

        const startBtn =
            document.getElementById(
                'startBtn'
            );


        if (startBtn) {
            startBtn.disabled = true;
        }


        // ====================================================
        // CÂMERA SELECIONADA
        // ====================================================

        const select =
            document.getElementById(
                'cameraSelect'
            );


        const id =
            select
                ? select.value
                : '';


        console.log(
            'Iniciando câmera...'
        );


        // ====================================================
        // GET USER MEDIA
        // ====================================================

        cameraStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        deviceId:
                            id
                                ? {
                                    exact: id
                                }
                                : undefined
                    }

                });


        console.log(
            'getUserMedia OK.'
        );


        // ====================================================
        // VÍDEO OCULTO ÚNICO
        // ====================================================

        hiddenVideo =
            document.createElement(
                'video'
            );


        hiddenVideo.srcObject =
            cameraStream;


        hiddenVideo.muted =
            true;


        hiddenVideo.autoplay =
            true;


        hiddenVideo.playsInline =
            true;


        hiddenVideo.style.display =
            'none';


        document.body.appendChild(
            hiddenVideo
        );


        await hiddenVideo.play();


        // ====================================================
        // ESPERA DIMENSÕES DA CÂMERA
        // ====================================================

        await new Promise(
            resolve => {

                if (
                    hiddenVideo.videoWidth > 0 &&
                    hiddenVideo.videoHeight > 0
                ) {

                    resolve();

                    return;
                }


                const check =
                    () => {

                        if (
                            hiddenVideo.videoWidth > 0 &&
                            hiddenVideo.videoHeight > 0
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


        console.log(
            `Vídeo da câmera pronto: ${
                hiddenVideo.videoWidth
            }x${
                hiddenVideo.videoHeight
            }`
        );


        // ====================================================
        // IMPORTA CONTROLADORES
        // ====================================================

        const {
            EmotionController
        } =
            await import(
                './detec_emotion.js'
            );


        const {
            HologramController
        } =
            await import(
                './control_holo.js'
            );


        // ====================================================
        // CRIA CONTROLADORES
        // ====================================================

        hCtrl =
            new HologramController();


        eCtrl =
            new EmotionController();


        console.log(
            'EmotionController:',
            eCtrl
        );


        console.log(
            'HologramController:',
            hCtrl
        );


        // ====================================================
        // CONFIGURA OS QUATRO CANVASES
        // ====================================================

        FACE_IDS.forEach(
            faceId => {

                /*
                 * PRIMEIRO procura o canvas.
                 *
                 * Isso é importante porque depois da primeira
                 * inicialização os elementos videoTop etc.
                 * já não existem mais.
                 */
                let canvas =
                    document.getElementById(
                        faceId +
                        '_canvas'
                    );


                /*
                 * Se o canvas ainda não existe,
                 * procura o elemento original.
                 */
                if (!canvas) {

                    const videoEl =
                        document.getElementById(
                            faceId
                        );


                    if (!videoEl) {

                        console.warn(
                            `Elemento ${faceId} não encontrado.`
                        );

                        return;
                    }


                    canvas =
                        document.createElement(
                            'canvas'
                        );


                    canvas.width =
                        300;


                    canvas.height =
                        300;


                    canvas.id =
                        faceId +
                        '_canvas';


                    /*
                     * Preserva a aparência original
                     * do elemento.
                     */
                    canvas.style.cssText =
                        videoEl.style.cssText;


                    canvas.className =
                        videoEl.className;


                    videoEl.parentNode
                        .replaceChild(
                            canvas,
                            videoEl
                        );
                }


                /*
                 * Registra o canvas no EmotionController.
                 */
                eCtrl.registerCanvas(
                    faceId,
                    canvas,
                    hiddenVideo
                );
            }
        );


        // ====================================================
        // CALLBACK DO CARROSSEL
        // ====================================================

        hCtrl._onCarouselChange =
            (
                faceEmotions,
                inEmotion,
                outEmotion,
                direction
            ) => {


                // ============================================
                // WIDGET INFINITO
                // ============================================

                updateInfinityWidget(
                    faceEmotions,
                    inEmotion,
                    outEmotion,
                    direction
                );


                // ============================================
                // LABELS
                // ============================================

                updateCarouselLabels(
                    faceEmotions
                );


                // ============================================
                // ÁUDIO DO CARROSSEL
                // ============================================

                /*
                 * ESTA É A REGRA IMPORTANTE:
                 *
                 * O áudio do carrossel é determinado
                 * pela expressão que está atualmente
                 * no holograma superior (videoTop).
                 */
                if (
                    carouselActive
                ) {

                    const topFace =
                        faceEmotions.find(
                            item =>
                                item.face ===
                                'videoTop'
                        );


                    if (
                        topFace &&
                        topFace.emotion
                    ) {

                        console.log(
                            'Carrossel — expressão no topo:',
                            topFace.emotion
                        );


                        playEmotionAudio(
                            topFace.emotion
                        );
                    }
                }
            };


        // ====================================================
        // CALLBACK DE EMOÇÃO
        // ====================================================

        eCtrl.onEmotionChange =
            (
                emotion,
                confidence
            ) => {


                console.log(
                    'MAIN recebeu emoção:',
                    emotion,
                    confidence
                );


                /*
                 * No carrossel, a IA continua funcionando,
                 * mas NÃO pode substituir a expressão
                 * controlada pelo carrossel.
                 */
                if (
                    carouselActive
                ) {

                    return;
                }


                // ============================================
                // NOME DA EXPRESSÃO
                // ============================================

                const expressionName =
                    document.getElementById(
                        'expressionName'
                    );


                if (expressionName) {

                    expressionName.innerText =
                        emotion.toUpperCase();
                }


                // ============================================
                // CONFIANÇA
                // ============================================

                const confidenceFill =
                    document.getElementById(
                        'confidenceFill'
                    );


                if (confidenceFill) {

                    const safeConfidence =
                        Math.max(
                            0,
                            Math.min(
                                1,
                                Number(confidence) || 0
                            )
                        );


                    confidenceFill.style.width =
                        (
                            safeConfidence *
                            100
                        ) + '%';
                }


                // ============================================
                // FILTRO
                // ============================================

                if (hCtrl) {

                    hCtrl.applyEmotionFilter(
                        emotion,
                        confidence
                    );
                }


                // ============================================
                // ÁUDIO
                // ============================================

                playEmotionAudio(
                    emotion
                );
            };


        // ====================================================
        // INICIA DETECÇÃO
        // ====================================================

        console.log(
            'Iniciando detecção...'
        );


        console.log(
            'DEBUG eCtrl =',
            eCtrl
        );


        console.log(
            'DEBUG startDetection =',
            eCtrl?.startDetection
        );


        /*
         * Marca como iniciado ANTES do startDetection.
         *
         * O startDetection inicia os loops internos e pode
         * retornar depois. Isso impede que um segundo clique
         * abra outra câmera nesse intervalo.
         */
        systemStarted = true;


        await eCtrl.startDetection(
            cameraStream,
            hiddenVideo
        );


        // ====================================================
        // UI
        // ====================================================

        const carouselBtn =
            document.getElementById(
                'carouselToggleBtn'
            );


        if (carouselBtn) {
            carouselBtn.disabled = false;
        }


        const landmarksBtn =
            document.getElementById(
                'landmarksToggleBtn'
            );


        if (landmarksBtn) {
            landmarksBtn.disabled = false;
        }


        updateStatus(
            'Holograma Online',
            'success'
        );


        console.log(
            'Holograma iniciado com sucesso.'
        );


    } catch (error) {

        console.error(
            'ERRO AO INICIAR HOLOGRAMA:',
            error
        );


        systemStarted = false;


        // ====================================================
        // LIMPA CÂMERA EM CASO DE ERRO
        // ====================================================

        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            cameraStream = null;
        }


        if (hiddenVideo) {

            try {
                hiddenVideo.pause();
            } catch (_) {}


            hiddenVideo.srcObject =
                null;


            if (
                hiddenVideo.parentNode
            ) {

                hiddenVideo.parentNode
                    .removeChild(
                        hiddenVideo
                    );
            }


            hiddenVideo = null;
        }


        hCtrl = null;
        eCtrl = null;


        updateStatus(
            'Erro ao iniciar',
            'danger'
        );


        const startBtn =
            document.getElementById(
                'startBtn'
            );


        if (startBtn) {
            startBtn.disabled = false;
        }


    } finally {

        startInProgress = false;
    }
}


// ============================================================
// SISTEMA DE ÁUDIO
// ============================================================

function playEmotionAudio(
    emotion
) {

    /*
     * Não reinicia o mesmo áudio.
     */
    if (
        emotion === currentEmotion &&
        currentAudio
    ) {

        return;
    }


    const src =
        AUDIO_MAP[emotion];


    if (!src) {

        console.warn(
            'Áudio não encontrado para:',
            emotion
        );

        return;
    }


    currentEmotion =
        emotion;


    /*
     * Cancela todos os fades anteriores.
     */
    const generation =
        invalidateAudioFades();


    /*
     * Cria imediatamente o novo áudio.
     *
     * O áudio antigo e o novo podem coexistir
     * durante o fade, produzindo uma transição
     * muito mais suave.
     */
    const newAudio =
        new Audio(src);


    newAudio.loop =
        true;


    setAudioVolume(
        newAudio,
        0
    );


    /*
     * Guarda o áudio atual imediatamente.
     */
    const oldAudio =
        currentAudio;


    currentAudio =
        newAudio;


    /*
     * Inicia o novo áudio.
     */
    newAudio
        .play()
        .catch(
            error => {

                console.warn(
                    'Não foi possível iniciar áudio:',
                    error
                );
            }
        );


    /*
     * Fade-in do novo áudio.
     */
    fadeInAudio(
        newAudio,
        generation
    );


    /*
     * Fade-out do áudio anterior.
     */
    if (oldAudio) {

        fadeOutAudio(
            oldAudio,
            generation
        );
    }
}


// ============================================================
// FADE IN
// ============================================================

function fadeInAudio(
    audio,
    generation
) {

    if (!audio) {
        return;
    }


    const target =
        0.7;


    const startTime =
        performance.now();


    function step(now) {

        /*
         * Se outro áudio foi solicitado,
         * este fade deixa imediatamente de atuar.
         */
        if (
            generation !==
            audioGeneration
        ) {

            return;
        }


        /*
         * Se o áudio deixou de ser o atual,
         * não deve mais controlar o volume.
         */
        if (
            audio !== currentAudio
        ) {

            return;
        }


        const elapsed =
            now -
            startTime;


        const progress =
            Math.min(
                elapsed /
                FADE_DURATION,
                1
            );


        const volume =
            target *
            progress;


        setAudioVolume(
            audio,
            volume
        );


        if (
            progress < 1
        ) {

            requestAnimationFrame(
                step
            );

        } else {

            setAudioVolume(
                audio,
                target
            );
        }
    }


    requestAnimationFrame(
        step
    );
}


// ============================================================
// FADE OUT
// ============================================================

function fadeOutAudio(
    audio,
    generation
) {

    if (!audio) {
        return;
    }


    const startVolume =
        clampVolume(
            audio.volume
        );


    const startTime =
        performance.now();


    function step(now) {

        /*
         * Se houve uma nova troca de áudio,
         * este fade antigo não pode mais mexer
         * no volume.
         */
        if (
            generation !==
            audioGeneration
        ) {

            return;
        }


        const elapsed =
            now -
            startTime;


        const progress =
            Math.min(
                elapsed /
                FADE_DURATION,
                1
            );


        const volume =
            startVolume *
            (
                1 -
                progress
            );


        setAudioVolume(
            audio,
            volume
        );


        if (
            progress < 1
        ) {

            requestAnimationFrame(
                step
            );

        } else {

            setAudioVolume(
                audio,
                0
            );


            try {
                audio.pause();
            } catch (_) {}


            /*
             * Não precisamos mais desse recurso.
             */
            try {
                audio.src = '';
            } catch (_) {}
        }
    }


    requestAnimationFrame(
        step
    );
}


// ============================================================
// PARA ÁUDIO
// ============================================================

function stopAudio() {

    /*
     * Invalida qualquer fade em andamento.
     */
    invalidateAudioFades();


    if (currentAudio) {

        const audio =
            currentAudio;


        currentAudio =
            null;


        try {

            setAudioVolume(
                audio,
                0
            );

            audio.pause();

            audio.src = '';

        } catch (error) {

            console.warn(
                'Erro ao parar áudio:',
                error
            );
        }
    }


    currentEmotion =
        null;
}


// ============================================================
// CARROSSEL
// ============================================================

function toggleCarousel() {

    if (
        !hCtrl ||
        !eCtrl
    ) {

        return;
    }


    carouselActive =
        !carouselActive;


    const btn =
        document.getElementById(
            'carouselToggleBtn'
        );


    const infinityEl =
        document.getElementById(
            'infinityWidget'
        );


    const aiPanel =
        document.getElementById(
            'aiPanel'
        );


    const carouselPanel =
        document.getElementById(
            'carouselPanel'
        );


    const hintEl =
        document.getElementById(
            'keyboardHint'
        );


    const lBtn =
        document.getElementById(
            'landmarksToggleBtn'
        );


    // ========================================================
    // ATIVA CARROSSEL
    // ========================================================

    if (carouselActive) {


        /*
         * IMPORTANTE:
         *
         * NÃO fazemos:
         *
         * eCtrl.active = false
         *
         * porque isso interromperia os loops
         * de detecção do EmotionController.
         *
         * A detecção continua rodando, mas o
         * callback onEmotionChange ignora suas
         * alterações enquanto carouselActive = true.
         */
        eCtrl.carouselMode =
            true;


        /*
         * Para o áudio da emoção detectada.
         */
        stopAudio();


        /*
         * Ativa o carrossel visual.
         *
         * enableCarousel() chama internamente
         * _applyCarouselFrame(), que por sua vez
         * dispara _onCarouselChange.
         *
         * Como carouselActive já está true,
         * o callback encontra videoTop e toca
         * o áudio da expressão que está no topo.
         */
        hCtrl.enableCarousel();


        // ====================================================
        // UI
        // ====================================================

        if (btn) {

            btn.classList.add(
                'active'
            );

            btn.innerHTML =
                '∞ CARROSSEL ON';
        }


        if (infinityEl) {

            infinityEl.classList.add(
                'visible'
            );
        }


        if (aiPanel) {

            aiPanel.classList.add(
                'hidden'
            );
        }


        if (carouselPanel) {

            carouselPanel.classList.remove(
                'hidden'
            );
        }


        if (hintEl) {

            hintEl.classList.remove(
                'hidden'
            );
        }


        if (lBtn) {

            lBtn.classList.add(
                'locked'
            );

            lBtn.title =
                'Indisponível no modo carrossel';
        }


        updateStatus(
            'Modo Carrossel Ativo',
            'warning'
        );


        /*
         * Garante que a interface esteja sincronizada
         * imediatamente após a ativação.
         */
        const faces =
            hCtrl.getCurrentFaceEmotions();


        updateCarouselLabels(
            faces
        );


        updateInfinityWidget(
            faces,
            null,
            null,
            0
        );


        /*
         * Garante explicitamente o áudio da expressão
         * que está em videoTop.
         *
         * Se o callback do enableCarousel() já tiver
         * feito isso, playEmotionAudio() simplesmente
         * não reinicia o mesmo áudio.
         */
        const topFace =
            faces.find(
                item =>
                    item.face ===
                    'videoTop'
            );


        if (
            topFace &&
            topFace.emotion
        ) {

            console.log(
                'Carrossel iniciado — expressão no topo:',
                topFace.emotion
            );


            playEmotionAudio(
                topFace.emotion
            );
        }


    } else {


        // ====================================================
        // DESATIVA CARROSSEL
        // ====================================================

        eCtrl.carouselMode =
            false;


        /*
         * A detecção já continuou rodando durante
         * o carrossel. Apenas voltamos para o modo normal.
         */
        eCtrl.active =
            true;


        stopAudio();


        hCtrl.disableCarousel();


        clearCarouselLabels();


        // ====================================================
        // UI
        // ====================================================

        if (btn) {

            btn.classList.remove(
                'active'
            );

            btn.innerHTML =
                '∞ CARROSSEL';
        }


        if (infinityEl) {

            infinityEl.classList.remove(
                'visible'
            );
        }


        if (aiPanel) {

            aiPanel.classList.remove(
                'hidden'
            );
        }


        if (carouselPanel) {

            carouselPanel.classList.add(
                'hidden'
            );
        }


        if (hintEl) {

            hintEl.classList.add(
                'hidden'
            );
        }


        if (lBtn) {

            lBtn.classList.remove(
                'locked'
            );

            lBtn.title = '';
        }


        updateStatus(
            'Holograma Online',
            'success'
        );


        console.log(
            'Carrossel desativado — segmentação continua ativa.'
        );
    }
}


// ============================================================
// LANDMARKS
// ============================================================

function toggleLandmarks() {

    if (!eCtrl) {
        return;
    }


    /*
     * Landmarks ficam bloqueados no carrossel.
     */
    if (carouselActive) {
        return;
    }


    landmarksActive =
        !landmarksActive;


    eCtrl.showLandmarks =
        landmarksActive;


    const btn =
        document.getElementById(
            'landmarksToggleBtn'
        );


    if (btn) {

        btn.classList.toggle(
            'active',
            landmarksActive
        );


        btn.innerHTML =
            landmarksActive
                ? '⬡ PONTOS ON'
                : '⬡ PONTOS FACIAIS';
    }
}


// ============================================================
// TECLADO — CARROSSEL
// ============================================================

document.addEventListener(
    'keydown',
    event => {

        if (
            !carouselActive ||
            !hCtrl
        ) {

            return;
        }


        if (
            event.key ===
                'ArrowRight' ||
            event.key ===
                'ArrowDown'
        ) {

            event.preventDefault();

            hCtrl.rotateCarousel(
                +1
            );


        } else if (
            event.key ===
                'ArrowLeft' ||
            event.key ===
                'ArrowUp'
        ) {

            event.preventDefault();

            hCtrl.rotateCarousel(
                -1
            );
        }
    }
);


// ============================================================
// LABELS DO CARROSSEL
// ============================================================

function updateCarouselLabels(
    faceEmotions
) {

    const faceMap = {

        videoTop:
            'labelTop',

        videoLeft:
            'labelLeft',

        videoRight:
            'labelRight',

        videoBottom:
            'labelBottom'
    };


    const panelMap = {

        videoTop:
            'labelTopPanel',

        videoLeft:
            'labelLeftPanel',

        videoRight:
            'labelRightPanel',

        videoBottom:
            'labelBottomPanel'
    };


    const grid =
        document.getElementById(
            'hologramGrid'
        );


    if (grid) {

        grid.classList.add(
            'carousel-active'
        );
    }


    faceEmotions.forEach(
        ({
            face,
            emotion,
            color
        }) => {


            const el =
                document.getElementById(
                    faceMap[face]
                );


            if (el) {

                el.innerText =
                    emotion.toUpperCase();


                el.style.color =
                    color;


                el.style.borderColor =
                    color +
                    '88';
            }


            const pel =
                document.getElementById(
                    panelMap[face]
                );


            if (pel) {

                pel.innerText =
                    emotion.toUpperCase();


                pel.style.color =
                    color;
            }
        }
    );
}


// ============================================================
// LIMPA LABELS
// ============================================================

function clearCarouselLabels() {

    const grid =
        document.getElementById(
            'hologramGrid'
        );


    if (grid) {

        grid.classList.remove(
            'carousel-active'
        );
    }
}


// ============================================================
// WIDGET INFINITO
// ============================================================

function updateInfinityWidget(
    faceEmotions,
    inEmotion,
    outEmotion,
    direction
) {

    const widget =
        document.getElementById(
            'infinityWidget'
        );


    /*
     * Quando o carrossel é inicializado,
     * inEmotion e outEmotion são null.
     *
     * Nesse caso não atualizamos os elementos
     * de entrada/saída, apenas mantemos o widget.
     */
    if (
        !widget ||
        !inEmotion
    ) {

        return;
    }


    const inColor =
        hCtrl.getFilterColor(
            inEmotion
        );


    const outColor =
        hCtrl.getFilterColor(
            outEmotion
        );


    const inEl =
        widget.querySelector(
            '.inf-in'
        );


    const outEl =
        widget.querySelector(
            '.inf-out'
        );


    if (inEl) {

        inEl.innerText =
            inEmotion;


        inEl.style.color =
            inColor;
    }


    if (outEl) {

        outEl.innerText =
            outEmotion;


        outEl.style.color =
            outColor;
    }


    /*
     * Reinicia a animação pulse.
     */
    widget.classList.remove(
        'pulse'
    );


    void widget.offsetWidth;


    widget.classList.add(
        'pulse'
    );
}


// ============================================================
// STATUS
// ============================================================

function updateStatus(
    message,
    type
) {

    const status =
        document.getElementById(
            'systemStatus'
        );


    if (!status) {
        return;
    }


    status.innerText =
        message;


    status.className =
        'small mb-2 text-' +
        type;
}


// ============================================================
// EVENTOS
// ============================================================

const startButton =
    document.getElementById(
        'startBtn'
    );


if (startButton) {

    startButton.addEventListener(
        'click',
        start
    );
}


const carouselButton =
    document.getElementById(
        'carouselToggleBtn'
    );


if (carouselButton) {

    carouselButton.addEventListener(
        'click',
        toggleCarousel
    );
}


const landmarksButton =
    document.getElementById(
        'landmarksToggleBtn'
    );


if (landmarksButton) {

    landmarksButton.addEventListener(
        'click',
        toggleLandmarks
    );
}


// ============================================================
// WINDOW LOAD
// ============================================================

window.onload =
    init;
