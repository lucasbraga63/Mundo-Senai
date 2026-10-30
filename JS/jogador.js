/* Jogador: movimento (WASD / setas), peça nas mãos, ações (E / Espaço) e descartar (Q) */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});
    const ESQ = ['a', 'arrowleft'], DIR = ['d', 'arrowright'];
    const CIMA = ['w', 'arrowup'], BAIXO = ['s', 'arrowdown'];
    const ACAO = ['e', ' ', 'enter'];

    class Jogador {
        constructor(el, container, cfg) {
            this.el = el;
            this.container = container;
            this.cfg = cfg;
            this.teclas = new Set();
            this.ativo = false;      // o jogo liga/desliga (overlays, fim de partida)
            this.carregando = null;  // tipo da peça nas mãos
            this.aoAcao = null;      // callbacks definidos pelo jogo.js
            this.aoSoltar = null;

            window.addEventListener('keydown', (e) => {
                if (!this.ativo) return;
                const k = e.key.toLowerCase();
                if ([...ESQ, ...DIR, ...CIMA, ...BAIXO, ...ACAO].includes(k)) e.preventDefault();
                this.teclas.add(k);
                if (e.repeat) return;
                if (ACAO.includes(k) && this.aoAcao) this.aoAcao();
                if (k === 'q' && this.aoSoltar) this.aoSoltar();
            });
            window.addEventListener('keyup', (e) => this.teclas.delete(e.key.toLowerCase()));
            window.addEventListener('blur', () => this.teclas.clear());
        }

        reiniciar() {
            this.x = this.container.clientWidth * 0.3;
            this.y = this.container.clientHeight * 0.62;
            this.teclas.clear();
            this.largar();
            this.render();
        }

        atualizar(dt) {
            if (!this.ativo) return;
            const t = (lista) => lista.some((k) => this.teclas.has(k));
            const dx = (t(DIR) ? 1 : 0) - (t(ESQ) ? 1 : 0);
            const dy = (t(BAIXO) ? 1 : 0) - (t(CIMA) ? 1 : 0);
            if (dx || dy) {
                const n = Math.hypot(dx, dy);
                this.x += (dx / n) * this.cfg.velocidade * dt;
                this.y += (dy / n) * this.cfg.velocidade * dt;
            }
            this.render();
        }

        render() {
            const maxX = this.container.clientWidth - this.el.offsetWidth;
            const maxY = this.container.clientHeight - this.el.offsetHeight;
            this.x = Math.max(0, Math.min(this.x, maxX));
            this.y = Math.max(0, Math.min(this.y, maxY));
            this.el.style.left = this.x + 'px';
            this.el.style.top = this.y + 'px';
        }

        get centro() {
            return { x: this.x + this.el.offsetWidth / 2, y: this.y + this.el.offsetHeight / 2 };
        }

        pegar(tipo) {
            this.carregando = tipo;
            this.el.dataset.peca = tipo;
            this.el.classList.add('carregando');
        }

        largar() {
            const tipo = this.carregando;
            this.carregando = null;
            delete this.el.dataset.peca;
            this.el.classList.remove('carregando');
            return tipo;
        }
    }

    MS.Jogador = Jogador;
})();