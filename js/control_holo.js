
export class HologramController {

    constructor() {

        // =========================================================
        // FACES DO HOLOGRAMA
        // =========================================================

        this._faceIds = [
            'videoTop',
            'videoLeft',
            'videoRight',
            'videoBottom'
        ];


        // =========================================================
        // NOMES DAS EMOÇÕES
        // =========================================================

        this.emotionPT = {

            happy:     'FELIZ',
            sad:       'TRISTE',
            angry:     'RAIVA',
            surprised: 'SURPRESO',
            fearful:   'MEDO',
            disgusted: 'NOJO',
            neutral:   'NEUTRO'

        };


        // =========================================================
        // FILTROS VISUAIS
        // =========================================================

        this.filters = {

            happy: {
                css: 'saturate(2) brightness(1.2) sepia(0.2)',
                color: '#FFD700'
            },

            sad: {
                css: 'hue-rotate(180deg) saturate(0.5) brightness(0.8)',
                color: '#4A90D9'
            },

            angry: {
                css: 'hue-rotate(320deg) saturate(3) contrast(1.5)',
                color: '#FF3B30'
            },

            surprised: {
                css: 'brightness(1.5) saturate(1.5)',
                color: '#FF9F0A'
            },

            fearful: {
                css: 'hue-rotate(260deg) saturate(2) brightness(0.9)',
                color: '#BF5AF2'
            },

            disgusted: {
                css: 'hue-rotate(90deg) saturate(2) contrast(1.2)',
                color: '#34C759'
            },

            neutral: {
                css: 'none',
                color: '#8E8E93'
            }

        };


        // =========================================================
        // ESTADO
        // =========================================================

        this.carouselMode = false;


        // Ordem fixa do carrossel

        this.emotionQueue = [
            'happy',
            'sad',
            'angry',
            'surprised',
            'fearful',
            'disgusted',
            'neutral'
        ];


        // Posição atual da janela de 4 emoções

        this.queueOffset = 0;


        // Callback externo

        this._onCarouselChange = null;

    }


    // =========================================================
    // OBTÉM OS ELEMENTOS VISUAIS
    // =========================================================

    _getEls() {

        return this._faceIds.map(id => {

            return (
                document.getElementById(id + '_canvas') ||
                document.getElementById(id)
            );

        });

    }


    // =========================================================
    // MODO IA
    // =========================================================

    applyEmotionFilter(emotion, confidence = 1) {

        if (this.carouselMode) {
            return;
        }


        const f =
            this.filters[emotion] ||
            this.filters.neutral;


        const safeConfidence =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(confidence) || 0
                )
            );


        this._getEls().forEach(el => {

            if (!el) {
                return;
            }


            el.style.filter = f.css;


            el.style.opacity =
                0.5 +
                safeConfidence * 0.5;

        });

    }


    // Compatibilidade com chamadas antigas

    applyEmotionFilterToCanvases(
        emotion,
        confidence
    ) {

        this.applyEmotionFilter(
            emotion,
            confidence
        );

    }


    // =========================================================
    // CARROSSEL
    // =========================================================

    enableCarousel() {

        this.carouselMode = true;


        this._applyCarouselFrame(
            0,
            null,
            null
        );

    }


    disableCarousel() {

        this.carouselMode = false;


        this._getEls().forEach(el => {

            if (!el) {
                return;
            }


            el.style.filter = 'none';
            el.style.opacity = '1';

        });

    }


    // =========================================================
    // ROTAÇÃO
    // =========================================================

    rotateCarousel(direction) {

        if (!this.carouselMode) {
            return null;
        }


        direction =
            direction >= 0
                ? 1
                : -1;


        const len =
            this.emotionQueue.length;


        const previousOffset =
            this.queueOffset;


        // Nova posição

        this.queueOffset =
            (
                this.queueOffset +
                direction +
                len
            ) % len;


        let inEmotion;
        let outEmotion;


        if (direction > 0) {

            // Indo para a direita:
            // a nova emoção que entra fica no final

            inEmotion =
                this.emotionQueue[
                    (
                        this.queueOffset + 3
                    ) % len
                ];


            // A que saiu era a primeira

            outEmotion =
                this.emotionQueue[
                    previousOffset
                ];

        } else {

            // Indo para a esquerda:
            // a nova emoção entra no início

            inEmotion =
                this.emotionQueue[
                    this.queueOffset
                ];


            // A que saiu era a última

            outEmotion =
                this.emotionQueue[
                    (
                        previousOffset + 3
                    ) % len
                ];

        }


        const faceEmotions =
            this._applyCarouselFrame(
                direction,
                inEmotion,
                outEmotion
            );


        return {

            inEmotion,
            outEmotion,
            direction,
            faceEmotions

        };

    }


    // =========================================================
    // APLICA QUADRO DO CARROSSEL
    // =========================================================

    _applyCarouselFrame(
        direction = 0,
        inEmotion = null,
        outEmotion = null
    ) {

        const len =
            this.emotionQueue.length;


        const els =
            this._getEls();


        const faceEmotions =
            this._faceIds.map(
                (id, i) => {

                    const emotion =
                        this.emotionQueue[
                            (
                                this.queueOffset +
                                i
                            ) % len
                        ];


                    const filter =
                        this.filters[emotion] ||
                        this.filters.neutral;


                    return {

                        face: id,

                        emotion,

                        label:
                            this.emotionPT[
                                emotion
                            ] ||
                            emotion.toUpperCase(),

                        color:
                            filter.color

                    };

                }
            );


        // =====================================================
        // APLICA VISUAL
        // =====================================================

        faceEmotions.forEach(
            ({ emotion }, i) => {

                const el =
                    els[i];


                if (!el) {
                    return;
                }


                const filter =
                    this.filters[emotion] ||
                    this.filters.neutral;


                el.style.filter =
                    filter.css;


                el.style.opacity =
                    '1';

            }
        );


        // =====================================================
        // AVISA O MAIN
        // =====================================================

        if (
            typeof this._onCarouselChange ===
            'function'
        ) {

            this._onCarouselChange(
                faceEmotions,
                inEmotion,
                outEmotion,
                direction
            );

        }


        return faceEmotions;

    }


    // =========================================================
    // EMOÇÕES ATUAIS
    // =========================================================

    getCurrentFaceEmotions() {

        const len =
            this.emotionQueue.length;


        return this._faceIds.map(
            (id, i) => {

                const emotion =
                    this.emotionQueue[
                        (
                            this.queueOffset +
                            i
                        ) % len
                    ];


                const filter =
                    this.filters[emotion] ||
                    this.filters.neutral;


                return {

                    face: id,

                    emotion,

                    label:
                        this.emotionPT[
                            emotion
                        ] ||
                        emotion.toUpperCase(),

                    color:
                        filter.color

                };

            }
        );

    }


    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    getEmotionLabel(emotion) {

        return (
            this.emotionPT[emotion] ||
            String(emotion).toUpperCase()
        );

    }


    getFilterColor(emotion) {

        return (
            this.filters[emotion] ||
            this.filters.neutral
        ).color;

    }

}
