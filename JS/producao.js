/* Carro em montagem na plataforma: quais peças faltam e quais já foram instaladas */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});

    class Producao {
        constructor(carroEl) {
            this.el = carroEl;
            // peças necessárias por carro (batem com os data-peca do jogo.html)
            this.req = { motor: 1, roda: 4, porta: 2, teto: 1 };
            this.reiniciar();
        }

        reiniciar() {
            this.inst = { motor: 0, roda: 0, porta: 0, teto: 0 };
            this.el.querySelectorAll('.peca').forEach((p) => p.classList.remove('instalada'));
        }

        precisa(tipo) { return this.inst[tipo] < this.req[tipo]; }

        instalar(tipo) {
            if (!this.precisa(tipo)) return false;
            const livre = [...this.el.querySelectorAll(`.peca[data-peca="${tipo}"]`)]
                .find((p) => !p.classList.contains('instalada'));
            if (!livre) return false;
            livre.classList.add('instalada');
            this.inst[tipo]++;
            return true;
        }

        get total() { return Object.values(this.req).reduce((a, b) => a + b, 0); }
        get feitas() { return Object.values(this.inst).reduce((a, b) => a + b, 0); }
        get completo() { return this.feitas === this.total; }

        // quantas das N etapas da barra de progresso estão cheias
        etapas(n = 5) { return Math.floor((this.feitas / this.total) * n); }
    }

    MS.Producao = Producao;
})();