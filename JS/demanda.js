/* Pedidos (demanda) da fábrica: fila + quadro de pedidos na tela */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});
    const CORES = ['notaAmarela', 'notaRosa', 'notaAzul'];

    class Demanda {
        constructor(el, cfg) { this.el = el; this.cfg = cfg; this.reiniciar(); }

        reiniciar() {
            this.fila = [];
            this.contador = 0;
            this.relogio = 0;
            for (let i = 0; i < this.cfg.pedidosIniciais; i++) this.novo();
            this.render();
        }

        novo() { this.contador++; this.fila.push({ numero: this.contador }); }

        atualizar(dt) {
            if (!this.cfg.intervaloPedidoS) return;
            this.relogio += dt;
            if (this.relogio >= this.cfg.intervaloPedidoS) {
                this.relogio = 0;
                this.novo();
                this.render();
            }
        }

        atender() {
            if (!this.fila.length) return false;
            this.fila.shift();
            this.render();
            return true;
        }

        get total() { return this.fila.length; }

        render() {
            const notas = this.fila.slice(0, 3).map((p) =>
                `<div class="nota ${CORES[(p.numero - 1) % 3]}"><span>CARRO ${p.numero}</span><i></i><i></i><i></i></div>`);
            if (this.fila.length > 3) notas.push(`<div class="maisPedidos">+${this.fila.length - 3}</div>`);
            this.el.innerHTML = notas.join('');
        }
    }

    MS.Demanda = Demanda;
})();