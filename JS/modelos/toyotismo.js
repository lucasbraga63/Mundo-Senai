/* ==========================================================
   JS/modelos/toyotismo.js · REGRAS DO TOYOTISMO

   Ideia: produção enxuta / just-in-time. A DEMANDA PUXA a produção.

   O que muda no jogo quando o modelo é o Toyotismo:
     1) SÓ SE PRODUZ O QUE FOI PEDIDO
        Não dá para começar um carro novo se os carros prontos no estoque
        já cobrem todos os pedidos do quadro (estoque mínimo, sem excesso).
     2) QUALIDADE É DO TRABALHADOR (jidoka)
        Algumas peças vêm com defeito. O jogador precisa conferir (a peça
        defeituosa fica vermelha e piscando) e rejeitar com Q.
        Se instalar peça defeituosa, o carro sai com defeito, vira
        retrabalho e é jogado fora.
     3) DESPERDÍCIO GERA PENALIDADE
        Descartar peça boa, produzir carro com defeito ou terminar com
        carro parado no estoque diminui o desempenho.
     4) TRABALHADOR POLIVALENTE
        Peças em várias áreas, repostas devagar: o jogador circula por
        todas as áreas e faz todas as funções (buscar, conferir, instalar,
        entregar), sem posto fixo.

   Os ganchos (hooks) abaixo são chamados pelo JS/jogo.js.
   ========================================================== */
(function () {
    const MS = (window.MundoSenai = window.MundoSenai || {});
    MS.modelos = MS.modelos || {};

    const CHANCE_DEFEITO = 0.25;   // chance de uma peça pegada estar com defeito
    const PENA_DESPERDICIO = 5;    // pontos de desempenho perdidos por peça boa jogada fora
    const PENA_DEFEITO = 8;        // pontos perdidos por carro que saiu com defeito
    const PENA_SOBRA = 6;          // pontos perdidos por carro sobrando no estoque ao final

    const NOMES = { motor: 'MOTOR', roda: 'RODA', porta: 'PORTA', teto: 'TETO' };

    // estado da partida (zerado em aoIniciar)
    const estado = {
        pecaDefeituosa: false,   // a peça que está na mão está com defeito?
        carroDefeituoso: false,  // o carro na plataforma já recebeu peça com defeito?
        desperdicio: 0,          // peças boas descartadas
        rejeitadas: 0,           // peças defeituosas rejeitadas (qualidade funcionando)
        defeitos: 0,             // carros que saíram com defeito (retrabalho)
        areasUsadas: new Set()   // áreas diferentes visitadas (polivalência)
    };

    function marcarMao(jogo, defeituosa) {
        estado.pecaDefeituosa = defeituosa;
        jogo.el.jogador.classList.toggle('pecaDefeituosa', defeituosa);
    }

    MS.modelos.toyotismo = {
        id: 'toyotismo',
        nome: 'TOYOTISMO',
        cor: '#992380',

        // valores que sobrescrevem os DEFAULTS do jogo.js
        config: {
            duracaoS: 120,
            pedidosIniciais: 2,     // poucos pedidos: nada de estoque grande
            intervaloPedidoS: 23,   // o cliente pede aos poucos
            reposicaoS: 5           // áreas repõem devagar: não existe fartura de peças
        },

        instrucoes: [
            'Aqui <b>só se produz o que foi pedido</b>. Olhe o quadro de <b>PEDIDOS</b>: sem pedido, sem carro novo.',
            'Você é <b>polivalente</b>: busca as peças em várias áreas, monta e entrega o carro.',
            'Você também é o <b>controle de qualidade</b>: peça <b>vermelha piscando</b> está com defeito. Rejeite com <b>Q</b>.',
            'Peça boa jogada fora, carro com defeito e carro parado no estoque são <b>desperdício</b> e baixam o desempenho.'
        ],

        explicacao: 'No Toyotismo a demanda puxa a produção (just-in-time): só se fabrica o que o cliente pediu e o estoque é mínimo. ' +
            'O trabalhador é polivalente: circula por várias funções e ainda cuida da qualidade, parando o erro na hora. ' +
            'Isso traz flexibilidade e menos desperdício, mas também mais responsabilidade e cobrança sobre quem trabalha.',

        hooks: {
            aoIniciar() {
                estado.pecaDefeituosa = false;
                estado.carroDefeituoso = false;
                estado.desperdicio = 0;
                estado.rejeitadas = 0;
                estado.defeitos = 0;
                estado.areasUsadas = new Set();
            },

            // PUXADA PELO PEDIDO: não começa carro novo se o estoque já cobre os pedidos
            podePegar(jogo) {
                const comecandoCarroNovo = jogo.producao.feitas === 0;
                if (comecandoCarroNovo && jogo.fabrica.prontos >= jogo.demanda.total) {
                    jogo.avisar('Sem pedido para um carro novo! No Toyotismo só se produz o que foi pedido.', 'erro');
                    return false;
                }
                return true;
            },

            // CONTROLE DE QUALIDADE: sorteia se a peça pegada veio com defeito
            aoPegar(jogo, tipo, area) {
                estado.areasUsadas.add(area.id);
                const defeituosa = Math.random() < CHANCE_DEFEITO;
                marcarMao(jogo, defeituosa);
                if (defeituosa) jogo.avisar(`${NOMES[tipo]} com DEFEITO! Rejeite com Q.`, 'erro');
            },

            // jogou a peça fora: rejeitar peça ruim é qualidade, jogar peça boa é desperdício
            aoSoltar(jogo) {
                if (estado.pecaDefeituosa) {
                    estado.rejeitadas++;
                    jogo.descartadas--;   // rejeitar peça ruim não é desperdício
                    jogo.avisar('Boa! Peça defeituosa rejeitada.', 'ok');
                } else {
                    estado.desperdicio++;
                }
                marcarMao(jogo, false);
            },

            // instalou uma peça: se estava com defeito, o carro inteiro fica comprometido
            aoInstalar(jogo) {
                if (estado.pecaDefeituosa) {
                    estado.carroDefeituoso = true;
                    jogo.avisar('Você instalou peça defeituosa! Esse carro vai dar retrabalho.', 'erro');
                }
                marcarMao(jogo, false);
            },

            // carro completo: se teve peça ruim, volta para retrabalho (não vai para o estoque)
            aoCompletarCarro(jogo) {
                if (!estado.carroDefeituoso) return;
                estado.carroDefeituoso = false;
                estado.defeitos++;
                jogo.fabrica.retirarCarro();
                jogo.produzidos--;
                jogo.avisar('Carro com DEFEITO: retrabalho! Foi descartado.', 'erro');
            },

            // desempenho = atendimento do pedido, menos penalidades de desperdício
            desempenho(jogo) {
                const total = jogo.entregues + jogo.demanda.total;
                const base = total ? (jogo.entregues / total) * 100 : 100;
                return base - estado.desperdicio * PENA_DESPERDICIO - estado.defeitos * PENA_DEFEITO;
            },

            // linhas extras na tela de resultado
            resultado(jogo) {
                const sobra = Math.max(0, jogo.fabrica.prontos - jogo.demanda.total);
                return [
                    { r: 'PEÇAS DEFEITUOSAS REJEITADAS', v: estado.rejeitadas },
                    { r: 'CARROS COM DEFEITO (RETRABALHO)', v: estado.defeitos },
                    { r: 'PEÇAS BOAS DESPERDIÇADAS', v: estado.desperdicio },
                    { r: 'ÁREAS DIFERENTES USADAS', v: estado.areasUsadas.size + ' de 4' },
                    { r: 'CARROS SOBRANDO NO ESTOQUE', v: sobra }
                ];
            }
        }
    };
})();
