/* ==========================================================
   JS/guia.js · GUIA DE SETAS
   Mostra, durante a partida, PARA ONDE o jogador deve ir agora:
   uma trilha de setas animadas sai do boneco e chega até o destino,
   o destino fica piscando e um rótulo diz o que fazer.

   O próximo passo é calculado a partir do estado do jogo:
     peça na mão  -> leva para a PLATAFORMA (ou descarta, se não serve)
     carro pronto + pedido -> leva ao CAMINHÃO
     senão        -> vai buscar a próxima peça que falta no carro
   Um modelo pode mudar isso com o gancho opcional `guia(jogo)`, que
   devolve { zona, texto } ou { texto } (só mensagem, sem seta).
   ========================================================== */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});

    const ORDEM = ['motor', 'roda', 'porta', 'teto'];
    const PEGAR = {
        motor: 'PEGUE O MOTOR',
        roda: 'PEGUE UMA RODA',
        porta: 'PEGUE UMA PORTA',
        teto: 'PEGUE O TETO'
    };

    const PASSO = 64;         // distância entre as setas (px)
    const SAIDA = 60;         // as setas só começam depois do boneco (px)
    const VELOCIDADE = 90;    // velocidade com que as setas "andam" (px/s)

    class Guia {
        constructor(jogo) {
            this.jogo = jogo;
            this.setas = [];
            this.destino = null;   // zona destacada no momento

            this.camada = document.createElement('div');
            this.camada.className = 'guiaSetas';
            this.camada.setAttribute('aria-hidden', 'true');
            this.camada.hidden = true;

            this.rotulo = document.createElement('div');
            this.rotulo.className = 'guiaRotulo';
            this.camada.appendChild(this.rotulo);

            jogo.el.container.appendChild(this.camada);
        }

        /* ---------- qual é o próximo passo? ---------- */
        passo() {
            const j = this.jogo;
            const extra = j.hook('guia');
            if (extra) return extra;

            const zonas = j.fabrica.zonas;
            const plataforma = zonas.find((z) => z.tipo === 'plataforma');
            const entrega = zonas.find((z) => z.tipo === 'entrega');
            const mao = j.jogador.carregando;

            if (mao) {
                if (j.producao.precisa(mao)) return { zona: plataforma, texto: 'LEVE PARA A PLATAFORMA' };
                return { texto: 'NÃO PRECISA · APERTE Q' };
            }

            if (j.fabrica.prontos > 0 && j.demanda.total > 0) {
                return { zona: entrega, el: entrega.els[entrega.els.length - 1], texto: 'ENTREGUE NO CAMINHÃO' };
            }

            for (const tipo of ORDEM) {
                if (!j.producao.precisa(tipo)) continue;
                const area = j.fabrica.areas.find((a) => a.tipo === tipo);
                if (area && area.slots.some((s) => !s.classList.contains('vazio'))) {
                    return { zona: zonas.find((z) => z.area === area), texto: PEGAR[tipo] };
                }
            }
            return { texto: 'AGUARDE AS PEÇAS VOLTAREM' };
        }

        /* ---------- desenho ---------- */
        atualizar(dt) {
            this.camada.hidden = false;
            this.t = (this.t || 0) + dt;

            const p = this.passo() || {};
            const zona = p.zona || null;
            this.destacar(zona);

            const c = this.jogo.jogador.centro;
            const perto = zona && this.jogo.zonaPerto() === zona;
            const el = zona ? (p.el || zona.els[0]) : null;

            // sem destino (só mensagem) ou já está no lugar: sem setas
            if (!el || perto) {
                this.esconderSetas(0);
                if (el) this.rotulo.hidden = true;
                else this.mostrarRotulo(p.texto, c.x, c.y - 52, true);
                return;
            }

            const alvo = this.pontoMaisPerto(el, c.x, c.y);
            const dx = alvo.x - c.x, dy = alvo.y - c.y;
            const dist = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);
            const ux = dx / dist || 0, uy = dy / dist || 0;

            const deslocamento = (this.t * VELOCIDADE) % PASSO;
            let n = 0;
            for (let s = SAIDA + deslocamento; s < dist - 20; s += PASSO) {
                const seta = this.seta(n++);
                const sobe = Math.min(1, (s - SAIDA) / 40);
                const desce = Math.min(1, (dist - 20 - s) / 40);
                seta.style.opacity = Math.max(0, Math.min(sobe, desce));
                seta.style.transform =
                    `translate(${c.x + ux * s}px, ${c.y + uy * s}px) rotate(${ang}rad) translate(-50%, -50%)`;
            }
            this.esconderSetas(n);

            // rótulo logo antes da ponta da trilha
            const recuo = Math.min(70, dist / 2);
            this.mostrarRotulo(p.texto, alvo.x - ux * recuo, alvo.y - uy * recuo, false);
        }

        seta(i) {
            if (!this.setas[i]) {
                const s = document.createElement('div');
                s.className = 'guiaSeta';
                s.innerHTML = '<i></i>';
                this.camada.appendChild(s);
                this.setas[i] = s;
            }
            const s = this.setas[i];
            s.hidden = false;
            return s;
        }

        esconderSetas(a) {
            for (let i = a; i < this.setas.length; i++) this.setas[i].hidden = true;
        }

        mostrarRotulo(texto, x, y, acimaDoBoneco) {
            const r = this.rotulo;
            if (!texto) { r.hidden = true; return; }
            r.hidden = false;
            if (r.textContent !== texto) r.textContent = texto;
            const W = this.jogo.el.container.clientWidth;
            const w = r.offsetWidth, h = r.offsetHeight;
            const cx = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, x));
            const cy = Math.max(h / 2 + 8, y - (acimaDoBoneco ? h / 2 : 0));
            r.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
        }

        // ponto do elemento mais próximo do jogador (coordenadas do container)
        pontoMaisPerto(el, cx, cy) {
            const c = this.jogo.el.container.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return {
                x: Math.max(r.left - c.left, Math.min(cx, r.right - c.left)),
                y: Math.max(r.top - c.top, Math.min(cy, r.bottom - c.top))
            };
        }

        // faz o destino piscar
        destacar(zona) {
            if (zona === this.destino) return;
            if (this.destino) this.destino.els.forEach((e) => e.classList.remove('destino'));
            if (zona) zona.els.forEach((e) => e.classList.add('destino'));
            this.destino = zona;
        }

        esconder() {
            this.destacar(null);
            this.camada.hidden = true;
        }
    }

    MS.Guia = Guia;
})();
