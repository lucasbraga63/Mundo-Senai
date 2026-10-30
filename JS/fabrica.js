/* Cenário: áreas de peças (com reposição), estoque de carros prontos e zonas de interação */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});
    const TIPO_DA_AREA = { motor: 'motor', rodas: 'roda', portas: 'porta', teto: 'teto' };

    class Fabrica {
        constructor(container, cfg) {
            this.container = container;
            this.cfg = cfg;
            this.areas = [...document.querySelectorAll('.areaPeca')].map((el) => ({
                id: el.dataset.area,
                tipo: TIPO_DA_AREA[el.dataset.area],
                el,
                slots: [...el.querySelectorAll('.slot')],
                repor: [] // cronômetros das peças que serão repostas
            }));
            this.caixas = [...document.querySelectorAll('#estoque .caixa')];

            const plataforma = document.getElementById('plataforma');
            const entrega = [document.getElementById('estoque'), document.getElementById('caminhao')];
            this.zonas = [
                ...this.areas.map((a) => ({ tipo: 'area', area: a, els: [a.el] })),
                { tipo: 'plataforma', els: [plataforma] },
                { tipo: 'entrega', els: entrega }
            ];
            this.alvo = null;
            this.reiniciar();
        }

        reiniciar() {
            this.areas.forEach((a) => { a.repor = []; a.slots.forEach((s) => s.classList.remove('vazio')); });
            this.prontos = 0;
            this.marcar(null);
            this.renderEstoque();
        }

        atualizar(dt) {
            for (const a of this.areas) {
                a.repor = a.repor.map((t) => t - dt);
                while (a.repor.length && a.repor[0] <= 0) {
                    a.repor.shift();
                    const vazio = a.slots.find((s) => s.classList.contains('vazio'));
                    if (vazio) vazio.classList.remove('vazio');
                }
            }
        }

        // tira uma peça da área (devolve o tipo da peça ou null se estiver vazia)
        retirar(area) {
            const slot = area.slots.find((s) => !s.classList.contains('vazio'));
            if (!slot) return null;
            slot.classList.add('vazio');
            area.repor.push(this.cfg.reposicaoS);
            return area.tipo;
        }

        guardarCarro() { this.prontos++; this.renderEstoque(); }

        retirarCarro() {
            if (!this.prontos) return false;
            this.prontos--;
            this.renderEstoque();
            return true;
        }

        renderEstoque() {
            this.caixas.forEach((c, i) => c.classList.toggle('vazia', i >= this.prontos));
        }

        // distância de um ponto (relativo ao container) até um elemento
        distancia(el, cx, cy) {
            const c = this.container.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            const dx = Math.max(r.left - c.left - cx, 0, cx - (r.right - c.left));
            const dy = Math.max(r.top - c.top - cy, 0, cy - (r.bottom - c.top));
            return Math.hypot(dx, dy);
        }

        // zona de interação mais próxima do jogador (ou null se estiver longe de tudo)
        zonaPerto(cx, cy, margem = 50) {
            let melhor = null, menor = Infinity;
            for (const z of this.zonas) {
                const d = Math.min(...z.els.map((el) => this.distancia(el, cx, cy)));
                if (d < menor) { menor = d; melhor = z; }
            }
            return menor <= margem ? melhor : null;
        }

        // destaca visualmente a zona que o jogador pode usar
        marcar(zona) {
            if (zona === this.alvo) return;
            if (this.alvo) this.alvo.els.forEach((e) => e.classList.remove('alvo'));
            if (zona) zona.els.forEach((e) => e.classList.add('alvo'));
            this.alvo = zona;
        }
    }

    MS.Fabrica = Fabrica;
})();