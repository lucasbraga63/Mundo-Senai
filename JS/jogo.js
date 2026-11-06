/* ==========================================================
   JS/jogo.js · O CÉREBRO DO JOGO
   Junta as peças que já existem (Fabrica, Jogador, Producao, Demanda),
   liga tudo ao jogo.html e cuida de: modelo escolhido, tempo, HUD,
   regras básicas, avisos e telas de início e fim.

   REGRAS BÁSICAS (valem para todos os modelos):
     E / Espaço  -> pega peça numa ÁREA, instala na PLATAFORMA
                    ou entrega um carro do ESTOQUE no caminhão
     Q           -> descarta a peça que está na mão
     WASD/setas  -> andar
   Cada modelo muda as regras com `config` e `hooks`
   (ver JS/modelos/*.js e DEFAULTS logo abaixo).
   ========================================================== */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});
    MS.modelos = MS.modelos || {};

    /* Valores padrão. Um modelo sobrescreve qualquer um em `config`. */
    const DEFAULTS = {
        duracaoS: 120,          // duração da partida
        velocidade: 520,        // velocidade do jogador (px/s)
        alcance: 70,            // distância (px) para usar uma área/plataforma/caminhão
        reposicaoS: 4,          // tempo para repor uma peça numa área
        pedidosIniciais: 2,     // pedidos já no quadro ao começar
        intervaloPedidoS: 30    // novo pedido a cada X segundos (0 = não chegam novos)
    };

    const NOMES = { motor: 'MOTOR', roda: 'RODAS', porta: 'PORTAS', teto: 'TETO' };

    /* Usado quando nenhum modelo foi escolhido/encontrado. */
    const MODELO_BASE = {
        id: 'livre',
        nome: 'MONTAGEM LIVRE',
        cor: '#2596e0',
        config: {},
        hooks: {},
        explicacao: 'Modo livre: sem regras de modelo de produção. Escolha um modelo na tela inicial para ver como cada um muda o trabalho.'
    };

    const INSTRUCOES = [
        'Pegue peças nas <b>ÁREAS</b> de baixo e leve até a <b>PLATAFORMA</b> para montar o carro.',
        'Carro pronto vai para o <b>ESTOQUE</b>. Leve-os ao <b>CAMINHÃO</b> para atender os pedidos do quadro.',
        'Peça errada na mão? Descarte com <b>Q</b>.'
    ];

    class Jogo {
        constructor() {
            const $ = (id) => document.getElementById(id);
            this.el = {
                container: $('containerJogo'),
                jogador: $('jogador'),
                carro: $('carro'),
                pedidos: $('listaPedidos'),
                caminhao: $('caminhao'),
                etapas: [...document.querySelectorAll('#progresso .etapa')],
                nomeModelo: $('nomeModelo'),
                hud: {
                    demanda: $('statDemanda'), produzidos: $('statProduzidos'), entregues: $('statEntregues'),
                    estoque: $('statEstoque'), tempo: $('statTempo'), desempenho: $('statDesempenho')
                }
            };

            this.modelo = this.escolherModelo();
            this.cfg = Object.assign({}, DEFAULTS, this.modelo.config || {});
            this.hooks = this.modelo.hooks || {};

            // o jogador anda por TODO o container (cenário + áreas de peças):
            // basta ele ser filho do container, que vira a referência de posição
            this.el.container.style.position = 'relative';
            this.el.container.appendChild(this.el.jogador);

            this.fabrica = new MS.Fabrica(this.el.container, this.cfg);
            this.producao = new MS.Producao(this.el.carro);
            this.demanda = new MS.Demanda(this.el.pedidos, this.cfg);
            this.jogador = new MS.Jogador(this.el.jogador, this.el.container, this.cfg);
            this.jogador.aoAcao = () => this.acao();
            this.jogador.aoSoltar = () => this.soltar();

            this.criarInterface();
            this.guia = new MS.Guia(this);
            this.zonaAtual = null;
            this.estado = 'inicio';        // inicio | jogando | fim
            this.ultimo = 0;
            this.zerar();

            this.el.nomeModelo.textContent = this.modelo.nome;
            this.el.nomeModelo.style.color = this.modelo.cor;
            document.title = `Mundo SENAI · ${this.modelo.nome}`;

            window.addEventListener('resize', () => this.jogador.render());
            this.mostrarInicio();
            requestAnimationFrame((t) => this.loop(t));
        }

        /* ---------------- modelo escolhido na tela inicial ---------------- */
        escolherModelo() {
            // 1) ?modelo=id na URL  2) o que a tela inicial guardou  3) modelo base
            let salvo = null;
            try { salvo = JSON.parse(sessionStorage.getItem('modeloSelecionado')); } catch (e) { /* ignora */ }
            const id = new URLSearchParams(window.location.search).get('modelo') || (salvo && salvo.id);
            return MS.modelos[id] || MODELO_BASE;
        }

        // chama um gancho do modelo, se ele existir
        hook(nome, ...args) {
            const f = this.hooks[nome];
            return typeof f === 'function' ? f(this, ...args) : undefined;
        }

        /* ---------------- estado da partida ---------------- */
        zerar() {
            this.tempo = this.cfg.duracaoS;
            this.produzidos = 0;
            this.entregues = 0;
            this.descartadas = 0;
            this.fabrica.reiniciar();
            this.producao.reiniciar();
            this.demanda.reiniciar();
            this.jogador.reiniciar();
            this.hudCache = {};
            this.atualizarEtapas();
            this.atualizarHud();
        }

        comecar() {
            this.esconderTela();
            this.estado = 'jogando';
            this.jogador.ativo = true;
            this.hook('aoIniciar');
        }

        reiniciar() {
            this.zerar();
            this.comecar();
        }

        terminar() {
            if (this.estado === 'fim') return;
            this.estado = 'fim';
            this.jogador.ativo = false;
            this.jogador.teclas.clear();
            this.fabrica.marcar(null);
            this.guia.esconder();
            this.dica('');
            this.mostrarFim();
        }

        /* ---------------- loop ---------------- */
        loop(agora) {
            const dt = Math.min(0.05, (agora - this.ultimo) / 1000 || 0);
            this.ultimo = agora;
            if (this.estado === 'jogando') this.atualizar(dt);
            requestAnimationFrame((t) => this.loop(t));
        }

        atualizar(dt) {
            this.tempo -= dt;
            this.jogador.atualizar(dt);
            this.fabrica.atualizar(dt);
            this.demanda.atualizar(dt);
            this.hook('aoAtualizar', dt);
            this.destacarZona();
            this.guia.atualizar(dt);
            this.atualizarHud();
            if (this.tempo <= 0 || this.hook('fim') === true) this.terminar();
        }

        /* ---------------- ações do jogador ---------------- */
        zonaPerto() {
            const c = this.jogador.centro;
            return this.fabrica.zonaPerto(c.x, c.y, this.cfg.alcance);
        }

        acao() {
            if (this.estado !== 'jogando') return;
            const z = this.zonaPerto();
            if (!z) return this.avisar('Chegue perto de uma área, da plataforma ou do caminhão.');
            if (z.tipo === 'area') this.pegar(z.area);
            else if (z.tipo === 'plataforma') this.instalar();
            else if (z.tipo === 'entrega') this.entregar();
        }

        pegar(area) {
            if (this.jogador.carregando) return this.avisar('Você já está com uma peça. Instale ou descarte (Q).', 'erro');
            if (this.hook('podePegar', area) === false) return;   // modelo pode barrar (ex.: Toyotismo sem pedido)
            const tipo = this.fabrica.retirar(area);
            if (!tipo) return this.avisar('Área vazia. Aguarde a reposição.', 'erro');
            this.jogador.pegar(tipo);
            this.avisar(`Pegou: ${NOMES[tipo]}`);
            this.hook('aoPegar', tipo, area);
        }

        instalar() {
            const tipo = this.jogador.carregando;
            if (!tipo) return this.avisar('Pegue uma peça numa das áreas primeiro.', 'erro');
            if (!this.producao.precisa(tipo)) return this.avisar(`O carro já tem ${NOMES[tipo]} suficiente.`, 'erro');
            this.producao.instalar(tipo);
            this.jogador.largar();
            this.atualizarEtapas();
            this.hook('aoInstalar', tipo);
            if (this.producao.completo) this.completarCarro();
        }

        completarCarro() {
            this.produzidos++;
            this.fabrica.guardarCarro();
            this.producao.reiniciar();
            this.atualizarEtapas();
            this.avisar('CARRO PRONTO! Foi para o estoque.', 'ok');
            this.hook('aoCompletarCarro');
        }

        entregar() {
            if (!this.fabrica.prontos) return this.avisar('Nenhum carro pronto no estoque.', 'erro');
            if (!this.demanda.total) return this.avisar('Não há pedidos pendentes.', 'erro');
            this.fabrica.retirarCarro();
            this.demanda.atender();
            this.entregues++;
            this.partirCaminhao();
            this.avisar('CARRO ENTREGUE!', 'ok');
            this.hook('aoEntregar');
        }

        soltar() {
            if (this.estado !== 'jogando' || !this.jogador.carregando) return;
            const tipo = this.jogador.largar();
            this.descartadas++;
            this.avisar('Peça descartada.', 'erro');
            this.hook('aoSoltar', tipo);
        }

        partirCaminhao() {
            const c = this.el.caminhao;
            c.classList.remove('partindo');
            void c.offsetWidth;              // reinicia a animação
            c.classList.add('partindo');
        }

        /* ---------------- HUD e cenário ---------------- */
        desempenho() {
            const h = this.hook('desempenho');
            if (typeof h === 'number') return Math.max(0, Math.min(100, Math.round(h)));
            const total = this.entregues + this.demanda.total;     // pedidos já atendidos / todos os pedidos
            return total ? Math.round((this.entregues / total) * 100) : 100;
        }

        tempoFmt() {
            const s = Math.max(0, Math.ceil(this.tempo));
            return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        }

        atualizarHud() {
            const v = {
                demanda: this.demanda.total, produzidos: this.produzidos, entregues: this.entregues,
                estoque: this.fabrica.prontos, tempo: this.tempoFmt(), desempenho: this.desempenho() + '%'
            };
            for (const k in v) {
                const txt = String(v[k]);
                if (this.hudCache[k] !== txt) { this.hudCache[k] = txt; this.el.hud[k].textContent = txt; }
            }
        }

        atualizarEtapas() {
            const n = this.producao.etapas(this.el.etapas.length);
            this.el.etapas.forEach((e, i) => e.classList.toggle('ok', i < n));
        }

        // destaca a zona que o jogador pode usar e mostra a dica sobre a cabeça dele
        destacarZona() {
            const z = this.zonaPerto();
            this.fabrica.marcar(z);
            let texto = '';
            if (z) {
                const c = this.jogador.carregando;
                if (z.tipo === 'area') texto = c ? '' : (z.area.slots.some((s) => !s.classList.contains('vazio')) ? `E · PEGAR ${NOMES[z.area.tipo]}` : 'ÁREA VAZIA');
                else if (z.tipo === 'plataforma') texto = c ? 'E · INSTALAR' : '';
                else if (z.tipo === 'entrega') texto = this.fabrica.prontos ? 'E · ENTREGAR CARRO' : 'SEM CARRO PRONTO';
            }
            this.dica(texto);
        }

        /* ---------------- interface criada por JS (avisos e telas) ---------------- */
        criarInterface() {
            this.ui = {
                aviso: document.createElement('div'),
                tela: document.createElement('div'),
                dica: document.createElement('span')
            };
            this.ui.aviso.className = 'avisoJogo';
            this.ui.aviso.setAttribute('role', 'status');
            this.ui.tela.className = 'telaJogo';
            this.ui.tela.hidden = true;
            this.ui.dica.className = 'dicaJogador';
            this.el.jogador.appendChild(this.ui.dica);
            document.body.append(this.ui.aviso, this.ui.tela);

            this.ui.tela.addEventListener('click', (e) => {
                const b = e.target.closest('[data-acao]');
                if (!b) return;
                if (b.dataset.acao === 'comecar') this.comecar();
                else if (b.dataset.acao === 'novamente') this.reiniciar();
                else if (b.dataset.acao === 'inicio') window.location.href = '../index.html';
            });
        }

        avisar(texto, tipo = 'info') {
            const a = this.ui.aviso;
            a.textContent = texto;
            a.className = `avisoJogo mostrar ${tipo}`;
            clearTimeout(this.avisoTimer);
            this.avisoTimer = setTimeout(() => { a.className = 'avisoJogo'; }, 2200);
        }

        dica(texto) {
            if (this.ui.dica.textContent !== texto) this.ui.dica.textContent = texto;
            this.ui.dica.classList.toggle('mostrar', !!texto);
        }

        esconderTela() { this.ui.tela.hidden = true; }

        mostrarInicio() {
            const m = this.modelo;
            const lista = (m.instrucoes || INSTRUCOES).map((t) => `<li>${t}</li>`).join('');
            this.ui.tela.innerHTML = `
                <div class="caixaJogo">
                    <p class="subJogo">VOCÊ ESCOLHEU</p>
                    <h1 style="color:${m.cor}">${m.nome}</h1>
                    <ul>${lista}</ul>
                    <p class="controlesJogo"><span>WASD / SETAS</span> andar · <span>E</span> ou <span>ESPAÇO</span> agir · <span>Q</span> descartar peça</p>
                    <button type="button" class="botaoJogo" data-acao="comecar">COMEÇAR</button>
                </div>`;
            this.ui.tela.hidden = false;
            this.ui.tela.querySelector('button').focus();
        }

        mostrarFim() {
            const m = this.modelo;
            const extra = this.hook('resultado');              // opcional: [{r, v}, ...] do modelo
            const linhas = [
                ['CARROS PRODUZIDOS', this.produzidos],
                ['CARROS ENTREGUES', this.entregues],
                ['CARROS NO ESTOQUE', this.fabrica.prontos],
                ['PEDIDOS PENDENTES', this.demanda.total],
                ['PEÇAS DESCARTADAS', this.descartadas],
                ['DESEMPENHO', this.desempenho() + '%']
            ].concat(Array.isArray(extra) ? extra.map((l) => [l.r, l.v]) : []);
            this.ui.tela.innerHTML = `
                <div class="caixaJogo">
                    <p class="subJogo">FIM DE JOGO</p>
                    <h1 style="color:${m.cor}">${m.nome}</h1>
                    <dl>${linhas.map(([r, v]) => `<div><dt>${r}</dt><dd>${v}</dd></div>`).join('')}</dl>
                    <div class="explicaJogo"><h2>O QUE VOCÊ VIVEU</h2><p>${m.explicacao || ''}</p></div>
                    <div class="botoesJogo">
                        <button type="button" class="botaoJogo" data-acao="novamente">JOGAR NOVAMENTE</button>
                        <button type="button" class="botaoJogo secundario" data-acao="inicio">ESCOLHER OUTRO MODELO</button>
                    </div>
                </div>`;
            this.ui.tela.hidden = false;
            this.ui.tela.querySelector('button').focus();
        }
    }

    MS.Jogo = Jogo;
    window.addEventListener('DOMContentLoaded', () => { MS.jogo = new Jogo(); });
})();