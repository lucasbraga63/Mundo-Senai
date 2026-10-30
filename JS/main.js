/* ==========================================================
   MUNDO SENAI · Tela inicial

   - Todos os dados de cada modelo ficam juntos na lista MODELOS.
   - O sistema cria os cards a partir dessa lista e controla a seleção.
   - Ao clicar em JOGAR, o modelo escolhido (com TODOS os dados) é salvo
     e a tela do jogo é aberta.
   ========================================================== */

const CHAVE_STORAGE = 'modeloSelecionado';
const PAGINA_JOGO = 'pages/jogo.html';


const MODELOS = [
   
    {
        id: 'toyotismo',
        nome: 'TOYOTISMO',
        icone: 'assets/icones/3.png',
        cor: '#992380',
        corEscura: '#4f75af',
        corClara: true,
        ritmo: 'Pedido do cliente',
        descricao: 'Só se produz o que foi pedido. Você circula por várias áreas, confere a qualidade das peças e evita desperdício.'
    },
     {
        id: 'modoLivre',
        nome: 'Produção livre',
        icone: 'assets/icones/MaoLivre.png',
        cor: '#b41207',
        corEscura: '#4f75af',
        corClara: true,
        ritmo: 'Nada',
        descricao: 'Modo de produção livre, ou seja, estoque infinito e produção a vontade.'
    },
];

// ---------- elementos da página ----------
const cardsEl = document.getElementById('cards');
const btnJogar = document.getElementById('btnJogar');
const statusEl = document.getElementById('status');
const descTitulo = document.getElementById('descTitulo');
const descCorpo = document.getElementById('descCorpo');
const descReserva = document.getElementById('descReserva');

// guarda o texto inicial para poder voltar a ele
const TITULO_PADRAO = descTitulo.textContent;
const CORPO_PADRAO = descCorpo.innerHTML;

// modelo escolhido no momento (null = nenhum)
let modeloSelecionado = null;

// ---------- cria os cards ----------
function criarCards() {
    cardsEl.innerHTML = MODELOS.map((m) => `
        <button type="button"
                class="card${m.corClara ? ' card-claro' : ''}"
                data-id="${m.id}"
                aria-pressed="false"
                style="--cor: ${m.cor}; --cor-escura: ${m.corEscura};">
            <span class="card-topo">
                <img src="${m.icone}" alt="" class="card-icone">
            </span>
            <span class="card-nome">${m.nome}</span>
        </button>
    `).join('');
}

// ---------- seleção ----------
function selecionarModelo(id) {
    modeloSelecionado = MODELOS.find((m) => m.id === id) || null;

    cardsEl.querySelectorAll('.card').forEach((card) => {
        const ativo = card.dataset.id === id;
        card.classList.toggle('selecionado', ativo);
        card.setAttribute('aria-pressed', String(ativo));
    });

    atualizarDescricao();
    atualizarBotao();
}

// texto do painel "Sobre" para um modelo
function textoDoModelo(modelo) {
    return `
        <p>${modelo.descricao}</p>
        <p class="ritmo"><span>QUEM DITA O RITMO</span>${modelo.ritmo}</p>
    `;
}

// Coloca todos os textos possíveis (invisíveis) no painel só para ele
// reservar a altura do maior: assim nada pula quando o jogador troca de modelo.
function reservarAlturaDoPainel() {
    const textos = [CORPO_PADRAO, ...MODELOS.map(textoDoModelo)];
    descReserva.innerHTML = textos.map((t) => `<div>${t}</div>`).join('');
}

function atualizarDescricao() {
    if (!modeloSelecionado) {
        descTitulo.textContent = TITULO_PADRAO;
        descTitulo.style.color = '';
        descCorpo.innerHTML = CORPO_PADRAO;
        return;
    }

    descTitulo.textContent = modeloSelecionado.nome;
    descTitulo.style.color = modeloSelecionado.cor;
    descCorpo.innerHTML = textoDoModelo(modeloSelecionado);
}

function atualizarBotao() {
    const temModelo = modeloSelecionado !== null;

    btnJogar.disabled = !temModelo;
    statusEl.classList.toggle('piscando', !temModelo);
    statusEl.textContent = temModelo
        ? `MODELO: ${modeloSelecionado.nome}`
        : 'ESCOLHA UM MODELO';
}

// ---------- iniciar o jogo ----------
function iniciarJogo() {
    if (!modeloSelecionado) return;

    // guarda o modelo inteiro (nome, cores, ritmo, descrição...) para a tela do jogo
    try {
        sessionStorage.setItem(CHAVE_STORAGE, JSON.stringify(modeloSelecionado));
    } catch (erro) {
        // se o navegador bloquear o storage, o id vai pela URL mesmo assim
    }

    window.location.href = `${PAGINA_JOGO}?modelo=${modeloSelecionado.id}`;
}

// ---------- eventos ----------
cardsEl.addEventListener('click', (evento) => {
    const card = evento.target.closest('.card');
    if (card) selecionarModelo(card.dataset.id);
});

btnJogar.addEventListener('click', iniciarJogo);

// ---------- começa ----------
criarCards();
reservarAlturaDoPainel();
atualizarBotao();

/* ----------------------------------------------------------
   COMO A TELA DO JOGO (pages/jogo.html) PEGA O MODELO ESCOLHIDO:

   const modelo = JSON.parse(sessionStorage.getItem('modeloSelecionado'));
   // modelo.id, modelo.nome, modelo.cor, modelo.ritmo, modelo.descricao ...

   Se o storage estiver vazio (ex.: abriu o jogo.html direto),
   dá para ler o id pela URL:

   const id = new URLSearchParams(window.location.search).get('modelo');
   ---------------------------------------------------------- */