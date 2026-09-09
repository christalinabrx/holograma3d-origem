// ============================================================
// ANGRY EFFECTS
// Sistema procedural de efeitos visuais para a emoção ANGRY
//
// Conceito:
// - tensão
// - pulsação
// - micro-glitches
// - fragmentos digitais
// - partículas lançadas para fora
// - picos de raiva
// - flashes rápidos
//
// Não altera a detecção de emoções.
// ============================================================

export class AngryEffects {

    constructor() {

        // =====================================================
        // ESTADO
        // =====================================================

        this.emotion = 'neutral';

        this.confidence = 0;

        this.intensity = 0;

        this.targetIntensity = 0;

        this.time = performance.now();

        // =====================================================
        // CONFIGURAÇÃO
        // =====================================================

        this.config = {

            // -------------------------------------------------
            // velocidade geral
            // -------------------------------------------------

            pulseSpeed: 0.006,

            // -------------------------------------------------
            // intensidade máxima do brilho
            // -------------------------------------------------

            maxGlow: 0.42,

            // -------------------------------------------------
            // quantidade de fragmentos
            // -------------------------------------------------

            maxFragments: 18,

            // -------------------------------------------------
            // quantidade de partículas
            // -------------------------------------------------

            maxParticles: 24,

            // -------------------------------------------------
            // frequência de glitches
            // -------------------------------------------------

            glitchIntervalMin: 350,

            glitchIntervalMax: 1100,

            // -------------------------------------------------
            // duração do glitch
            // -------------------------------------------------

            glitchDuration: 70,

            // -------------------------------------------------
            // intervalo médio entre picos
            // -------------------------------------------------

            peakIntervalMin: 1400,

            peakIntervalMax: 3200

        };

        // =====================================================
        // GLITCH
        // =====================================================

        this.glitchTimer = 0;

        this.nextGlitch =
            this._random(
                this.config.glitchIntervalMin,
                this.config.glitchIntervalMax
            );

        this.glitchRemaining = 0;

        // =====================================================
        // PICO
        // =====================================================

        this.peakTimer = 0;

        this.nextPeak =
            this._random(
                this.config.peakIntervalMin,
                this.config.peakIntervalMax
            );

        this.peakIntensity = 0;

        // =====================================================
        // FRAGMENTOS
        // =====================================================

        this.fragments = [];

        // =====================================================
        // PARTÍCULAS
        // =====================================================

        this.particles = [];

        // =====================================================
        // FLASH
        // =====================================================

        this.flash = 0;

    }


    // =========================================================
    // RECEBE EMOÇÃO
    // =========================================================

    setEmotion(
        emotion,
        confidence
    ) {

        this.emotion =
            emotion || 'neutral';

        this.confidence =
            confidence || 0;


        // -----------------------------------------------------
        // ANGRY
        // -----------------------------------------------------

        if (
            this.emotion === 'angry'
        ) {

            this.targetIntensity =
                Math.max(
                    0,
                    Math.min(
                        1,
                        (
                            this.confidence -
                            0.30
                        ) / 0.70
                    )
                );

        } else {

            this.targetIntensity = 0;

        }

    }


    // =========================================================
    // UPDATE
    // =========================================================

    update(delta) {

        const dt =
            Math.max(
                0,
                Math.min(
                    delta,
                    100
                )
            );


        // -----------------------------------------------------
        // SUAVIZA INTENSIDADE
        // -----------------------------------------------------

        const smoothing =
            this.targetIntensity >
            this.intensity
                ? 0.08
                : 0.045;

        this.intensity +=
            (
                this.targetIntensity -
                this.intensity
            ) *
            smoothing;


        // -----------------------------------------------------
        // TEMPO
        // -----------------------------------------------------

        this.time += dt;


        // -----------------------------------------------------
        // GLITCH
        // -----------------------------------------------------

        if (
            this.intensity > 0.05
        ) {

            this.glitchTimer += dt;

            if (
                this.glitchTimer >=
                this.nextGlitch
            ) {

                this.glitchRemaining =
                    this.config.glitchDuration *
                    (
                        0.7 +
                        this.intensity * 0.8
                    );

                this.glitchTimer = 0;

                this.nextGlitch =
                    this._random(
                        this.config.glitchIntervalMin,
                        this.config.glitchIntervalMax
                    ) *
                    (
                        1.25 -
                        this.intensity * 0.45
                    );

            }

        } else {

            this.glitchTimer = 0;

            this.glitchRemaining = 0;

        }


        if (
            this.glitchRemaining > 0
        ) {

            this.glitchRemaining -= dt;

        }


        // -----------------------------------------------------
        // PICO DE RAIVA
        // -----------------------------------------------------

        if (
            this.intensity > 0.18
        ) {

            this.peakTimer += dt;

            if (
                this.peakTimer >=
                this.nextPeak
            ) {

                this.peakTimer = 0;

                this.peakIntensity =
                    0.55 +
                    Math.random() *
                    0.45;

                this.flash =
                    0.15 +
                    Math.random() *
                    0.25;

                this._spawnPeakFragments();

                this._spawnPeakParticles();

                this.nextPeak =
                    this._random(
                        this.config.peakIntervalMin,
                        this.config.peakIntervalMax
                    ) /
                    (
                        0.65 +
                        this.intensity * 0.5
                    );

            }

        } else {

            this.peakTimer = 0;

        }


        // -----------------------------------------------------
        // DECAY DO PICO
        // -----------------------------------------------------

        this.peakIntensity *=
            Math.pow(
                0.90,
                dt / 16.67
            );


        // -----------------------------------------------------
        // DECAY DO FLASH
        // -----------------------------------------------------

        this.flash *=
            Math.pow(
                0.82,
                dt / 16.67
            );


        // -----------------------------------------------------
        // ATUALIZA FRAGMENTOS
        // -----------------------------------------------------

        for (
            let i =
                this.fragments.length - 1;
            i >= 0;
            i--
        ) {

            const fragment =
                this.fragments[i];

            fragment.life -= dt;

            fragment.x +=
                fragment.vx *
                dt;

            fragment.y +=
                fragment.vy *
                dt;

            fragment.rotation +=
                fragment.rotationSpeed *
                dt;

            fragment.vx *=
                Math.pow(
                    0.996,
                    dt
                );

            fragment.vy *=
                Math.pow(
                    0.996,
                    dt
                );

            if (
                fragment.life <= 0
            ) {

                this.fragments.splice(
                    i,
                    1
                );

            }

        }


        // -----------------------------------------------------
        // ATUALIZA PARTÍCULAS
        // -----------------------------------------------------

        for (
            let i =
                this.particles.length - 1;
            i >= 0;
            i--
        ) {

            const particle =
                this.particles[i];

            particle.life -= dt;

            particle.x +=
                particle.vx *
                dt;

            particle.y +=
                particle.vy *
                dt;

            particle.vx *=
                Math.pow(
                    0.997,
                    dt
                );

            particle.vy *=
                Math.pow(
                    0.997,
                    dt
                );

            if (
                particle.life <= 0
            ) {

                this.particles.splice(
                    i,
                    1
                );

            }

        }


        // -----------------------------------------------------
        // QUANDO SAI DO ANGRY
        // -----------------------------------------------------

        if (
            this.intensity < 0.01 &&
            this.targetIntensity <= 0
        ) {

            this.fragments.length = 0;

            this.particles.length = 0;

            this.peakIntensity = 0;

        }

    }


    // =========================================================
    // DESENHA
    // =========================================================

    draw(
        ctx,
        options
    ) {

        if (
            !ctx ||
            !options
        ) {

            return;

        }


        const {

            drawX = 0,
            drawY = 0,
            drawWidth = ctx.canvas.width,
            drawHeight = ctx.canvas.height

        } = options;


        if (
            this.intensity < 0.01
        ) {

            return;

        }


        const cx =
            drawX +
            drawWidth / 2;

        const cy =
            drawY +
            drawHeight * 0.45;


        // =====================================================
        // INTENSIDADE
        // =====================================================

        const pulse =
            (
                Math.sin(
                    this.time *
                    this.config.pulseSpeed
                ) +
                1
            ) /
            2;


        const tension =
            this.intensity *
            (
                0.72 +
                pulse * 0.28
            );


        const peak =
            this.peakIntensity *
            this.intensity;


        ctx.save();


        // =====================================================
        // MODO DE COMPOSIÇÃO
        // =====================================================

        ctx.globalCompositeOperation =
            'screen';


        // =====================================================
        // HALO VERMELHO
        // =====================================================

        const glowRadius =
            Math.min(
                drawWidth,
                drawHeight
            ) *
            (
                0.28 +
                tension * 0.12
            );


        const gradient =
            ctx.createRadialGradient(
                cx,
                cy,
                glowRadius * 0.15,
                cx,
                cy,
                glowRadius
            );


        gradient.addColorStop(
            0,
            `rgba(255, 20, 20, ${
                0.035 +
                tension * 0.055
            })`
        );


        gradient.addColorStop(
            0.55,
            `rgba(190, 0, 0, ${
                tension * 0.045
            })`
        );


        gradient.addColorStop(
            1,
            'rgba(120, 0, 0, 0)'
        );


        ctx.fillStyle =
            gradient;


        ctx.fillRect(
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );


        // =====================================================
        // FLASH DE PICO
        // =====================================================

        if (
            this.flash > 0.01
        ) {

            ctx.fillStyle =
                `rgba(255, 30, 30, ${
                    this.flash *
                    this.intensity *
                    0.12
                })`;

            ctx.fillRect(
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );

        }


        // =====================================================
        // GLITCH
        // =====================================================

        if (
            this.glitchRemaining > 0
        ) {

            this._drawGlitch(
                ctx,
                drawX,
                drawY,
                drawWidth,
                drawHeight,
                tension
            );

        }


        // =====================================================
        // FRAGMENTOS
        // =====================================================

        this._drawFragments(
            ctx,
            tension,
            drawX,
            drawY
        );


        // =====================================================
        // PARTÍCULAS
        // =====================================================

        this._drawParticles(
            ctx,
            tension,
            drawX,
            drawY
        );


        // =====================================================
        // RACHADURAS RADIAIS
        // =====================================================

        this._drawEnergyCracks(
            ctx,
            cx,
            cy,
            drawWidth,
            drawHeight,
            tension,
            peak
        );


        ctx.restore();

    }


    // =========================================================
    // GLITCH
    // =========================================================

    _drawGlitch(
        ctx,
        x,
        y,
        width,
        height,
        intensity
    ) {

        const number =
            Math.floor(
                2 +
                intensity * 5
            );


        for (
            let i = 0;
            i < number;
            i++
        ) {

            const barHeight =
                1 +
                Math.random() *
                Math.max(
                    2,
                    height * 0.018
                );


            const barY =
                y +
                Math.random() *
                height;


            const offset =
                (
                    Math.random() -
                    0.5
                ) *
                width *
                0.045 *
                intensity;


            const alpha =
                0.10 +
                Math.random() *
                0.20;


            ctx.fillStyle =
                `rgba(255, 25, 25, ${alpha})`;


            ctx.fillRect(
                x + offset,
                barY,
                width,
                barHeight
            );

        }

    }


    // =========================================================
    // FRAGMENTOS
    // =========================================================

    _drawFragments(
        ctx,
        intensity,
        drawX,
        drawY
    ) {

        for (
            const fragment
            of this.fragments
        ) {

            const alpha =
                Math.max(
                    0,
                    Math.min(
                        1,
                        fragment.life /
                        fragment.maxLife
                    )
                ) *
                intensity;


            if (
                alpha <= 0
            ) {

                continue;

            }


            ctx.save();


            ctx.translate(
                drawX +
                fragment.x,
                drawY +
                fragment.y
            );


            ctx.rotate(
                fragment.rotation
            );


            ctx.globalAlpha =
                alpha;


            ctx.fillStyle =
                fragment.color;


            ctx.fillRect(
                -fragment.width / 2,
                -fragment.height / 2,
                fragment.width,
                fragment.height
            );


            ctx.restore();

        }

    }


    // =========================================================
    // PARTÍCULAS
    // =========================================================

    _drawParticles(
        ctx,
        intensity,
        drawX,
        drawY
    ) {

        for (
            const particle
            of this.particles
        ) {

            const alpha =
                Math.max(
                    0,
                    Math.min(
                        1,
                        particle.life /
                        particle.maxLife
                    )
                ) *
                intensity;


            ctx.globalAlpha =
                alpha;


            ctx.fillStyle =
                particle.color;


            ctx.fillRect(
                drawX +
                particle.x,
                drawY +
                particle.y,
                particle.size,
                particle.size
            );

        }

        ctx.globalAlpha = 1;

    }


    // =========================================================
    // RACHADURAS / ENERGIA
    // =========================================================

    _drawEnergyCracks(
        ctx,
        cx,
        cy,
        width,
        height,
        intensity,
        peak
    ) {

        const count =
            Math.floor(
                4 +
                intensity * 6
            );


        ctx.save();


        ctx.lineWidth =
            1 +
            intensity * 1.5;


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const angle =
                (
                    Math.PI * 2 *
                    i /
                    count
                ) +
                Math.sin(
                    this.time *
                    0.002 +
                    i
                ) *
                0.15;


            const startRadius =
                Math.min(
                    width,
                    height
                ) *
                (
                    0.27 +
                    Math.random() *
                    0.08
                );


            const length =
                Math.min(
                    width,
                    height
                ) *
                (
                    0.035 +
                    intensity * 0.06 +
                    peak * 0.05
                );


            const sx =
                cx +
                Math.cos(angle) *
                startRadius;


            const sy =
                cy +
                Math.sin(angle) *
                startRadius;


            const ex =
                sx +
                Math.cos(angle) *
                length;


            const ey =
                sy +
                Math.sin(angle) *
                length;


            const alpha =
                0.04 +
                intensity * 0.10 +
                peak * 0.12;


            ctx.strokeStyle =
                `rgba(255, 40, 40, ${alpha})`;


            ctx.beginPath();

            ctx.moveTo(
                sx,
                sy
            );


            // pequeno desvio para parecer
            // uma fratura digital

            const mx =
                (
                    sx +
                    ex
                ) / 2 +
                (
                    Math.random() -
                    0.5
                ) *
                length *
                0.35;


            const my =
                (
                    sy +
                    ey
                ) / 2 +
                (
                    Math.random() -
                    0.5
                ) *
                length *
                0.35;


            ctx.lineTo(
                mx,
                my
            );


            ctx.lineTo(
                ex,
                ey
            );


            ctx.stroke();

        }


        ctx.restore();

    }


    // =========================================================
    // CRIA FRAGMENTOS
    // =========================================================

    _spawnPeakFragments() {

        const amount =
            Math.floor(
                5 +
                this.intensity * 8
            );


        for (
            let i = 0;
            i < amount;
            i++
        ) {

            if (
                this.fragments.length >=
                this.config.maxFragments
            ) {

                break;

            }


            const angle =
                Math.random() *
                Math.PI *
                2;


            const radius =
                85 +
                Math.random() *
                80;


            const speed =
                0.025 +
                Math.random() *
                0.09;


            this.fragments.push({

                x:
                    Math.cos(angle) *
                    radius,

                y:
                    Math.sin(angle) *
                    radius *
                    0.8,

                vx:
                    Math.cos(angle) *
                    speed,

                vy:
                    Math.sin(angle) *
                    speed,

                width:
                    2 +
                    Math.random() * 7,

                height:
                    1 +
                    Math.random() * 3,

                rotation:
                    Math.random() *
                    Math.PI,

                rotationSpeed:
                    (
                        Math.random() -
                        0.5
                    ) *
                    0.01,

                life:
                    350 +
                    Math.random() *
                    700,

                maxLife:
                    1050,

                color:
                    Math.random() > 0.35
                        ? '#ff2020'
                        : '#ff6666'

            });

        }

    }


    // =========================================================
    // CRIA PARTÍCULAS
    // =========================================================

    _spawnPeakParticles() {

        const amount =
            Math.floor(
                5 +
                this.intensity * 10
            );


        for (
            let i = 0;
            i < amount;
            i++
        ) {

            if (
                this.particles.length >=
                this.config.maxParticles
            ) {

                break;

            }


            const angle =
                Math.random() *
                Math.PI *
                2;


            const radius =
                70 +
                Math.random() *
                120;


            const speed =
                0.025 +
                Math.random() *
                0.08;


            this.particles.push({

                x:
                    Math.cos(angle) *
                    radius,

                y:
                    Math.sin(angle) *
                    radius *
                    0.85,

                vx:
                    Math.cos(angle) *
                    speed,

                vy:
                    Math.sin(angle) *
                    speed,

                size:
                    1 +
                    Math.random() * 3,

                life:
                    300 +
                    Math.random() *
                    600,

                maxLife:
                    900,

                color:
                    Math.random() > 0.3
                        ? '#ff3030'
                        : '#ff9090'

            });

        }

    }


    // =========================================================
    // UTILITÁRIO
    // =========================================================

    _random(
        min,
        max
    ) {

        return (
            min +
            Math.random() *
            (
                max -
                min
            )
        );

    }

}
