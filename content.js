let isChecking = true;
let elementoAtivo = null;
let infoPalavraClicada = null;


//CRIAÇÃO DO POPUP
const popup = document.createElement('div');
popup.id = 'corretor-popup-exclusivo';
popup.style.cssText = `
  position: fixed !important;
  display: none !important;
  z-index: 2147483647 !important;
  background-color: #2c2c2c !important;
  color: #ffffff !important;
  padding: 10px !important;
  border-radius: 8px !important;
  box-shadow: 0px 5px 15px rgba(0,0,0,0.5) !important;
  border: 1px solid #444444 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
  font-size: 13px !important;
  box-sizing: border-box !important;
  max-width: 280px !important;
`;
document.documentElement.appendChild(popup);

// fecha o popup quando clicar fora dele
document.addEventListener('click', (e) => {
  if (e.target.id !== 'corretor-popup-exclusivo' && !popup.contains(e.target)) {
    popup.style.setProperty('display', 'none', 'important');
  }
}, { passive: true });

//Ler o texto

document.addEventListener('click', (e) => {
  if (!isChecking) return;
  
  const target = e.target;
  elementoAtivo = target.closest('input, textarea, [contenteditable="true"]');
  
  if (!elementoAtivo) return;

  setTimeout(() => {
    let texto = "";
    let posicaoCursor = 0;
    let éEditableDiv = elementoAtivo.getAttribute('contenteditable') === 'true';

    if (éEditableDiv) {
      // logica para pegar dados dentro do editor do WhatsApp
      const selecao = window.getSelection();
      if (!selecao.rangeCount) return;
      
      const range = selecao.getRangeAt(0);
      const cloneRange = range.cloneRange();
      cloneRange.selectNodeContents(elementoAtivo);
      cloneRange.setEnd(range.endContainer, range.endOffset);
      
      texto = elementoAtivo.innerText || elementoAtivo.textContent || "";
      posicaoCursor = cloneRange.toString().length;
    } else {
      // campos normais inputs e textareas
      texto = elementoAtivo.value || "";
      posicaoCursor = elementoAtivo.selectionStart || 0;
    }

    if (posicaoCursor !== null && texto) {
      const caractereClicado = texto[posicaoCursor] || '';
      const caractereAnterior = posicaoCursor > 0 ? texto[posicaoCursor - 1] : '';
      const regexLetra = /[a-zA-ZáàâãéèêíïóôõúçÁÀÂÃÉÈÊÍÏÓÔÕÚÇ]/;

      // so avança se clicou em cima ou encostado em uma letra de verdade
      if (regexLetra.test(caractereClicado) || regexLetra.test(caractereAnterior)) {
        processarVerificacao(elementoAtivo, texto, posicaoCursor, éEditableDiv);
      } else {
        popup.style.setProperty('display', 'none', 'important');
      }
    }
  }, 30);
});


// INSERÇÃO DO TEXTO NO FORMATO DO SITE
function aplicarCorrecaoNoTexto(target, textoCompleto, inicio, fim, novoTermo, éDiv) {
  if (éDiv) {
    // Foca o chat e deixa o comando nativo substituir a seleção que criamos
    target.focus();
    document.execCommand('insertText', false, novoTermo);
  } else {
    // Inputs e Textareas tradicionais
    const novoTexto = textoCompleto.slice(0, inicio) + novoTermo + textoCompleto.slice(fim);
    target.value = novoTexto;
    const novaPosicaoCursor = inicio + novoTermo.length;
    target.setSelectionRange(novaPosicaoCursor, novaPosicaoCursor);
  }

  // Notifica o React/Vue da página que o texto mudou
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

//PRESERVAÇÃO DE CAIXA DE LETRA

function ajustarCapitalizacao(palavraOriginal, palavraSugestao) {
  if (!palavraOriginal || !palavraSugestao) return palavraSugestao;
  if (palavraOriginal === palavraOriginal.toUpperCase()) return palavraSugestao.toUpperCase();
  if (palavraOriginal[0] === palavraOriginal[0].toUpperCase()) {
    return palavraSugestao.charAt(0).toUpperCase() + palavraSugestao.slice(1);
  }
  return palavraSugestao.toLowerCase();
}


// PROCESSAMENTO PRINCIPAL
function processarVerificacao(targetElement, textoCompleto, posicaoMapeada, éEditableDiv) {
  if (!chrome.runtime || !chrome.runtime.id) return;

  chrome.runtime.sendMessage({
    action: 'analisarTexto',
    texto: textoCompleto,
    posicao: posicaoMapeada
  }, (response) => {
    if (chrome.runtime.lastError || !response || response.tipo === 'correto' || response.tipo === 'invalido') {
      popup.style.setProperty('display', 'none', 'important');
      return;
    }

    infoPalavraClicada = {
      palavra: response.palavra,
      inicio: response.inicio,
      fim: response.fim
    };

    const rect = targetElement.getBoundingClientRect();
    popup.innerHTML = '';

    // cabeçalho de erro descritivo do LanguageTool
    const labelErro = document.createElement('div');
    labelErro.innerText = response.mensagem;
    labelErro.style.cssText = "color: #ff6b6b !important; font-weight: bold !important; margin-bottom: 6px !important; font-size: 11px !important; line-height: 1.3 !important;";
    popup.appendChild(labelErro);

    const containerBotoes = document.createElement('div');

    if (response.sugestoes.length === 0) {
      containerBotoes.innerHTML = "<span style='color:#bbb !important;'>Sem sugestões</span>";
    } else {
      response.sugestoes.forEach(s => {
        const sugestaoFormatada = ajustarCapitalizacao(infoPalavraClicada.palavra, s);
        const btn = document.createElement('button');
        btn.innerText = sugestaoFormatada;
        btn.style.cssText = `
          background: #444444 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 5px 9px !important;
          margin: 2px !important;
          border-radius: 4px !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: bold !important;
          display: inline-block !important;
        `;

        btn.addEventListener('mouseenter', () => btn.style.background = '#555555');
        btn.addEventListener('mouseleave', () => btn.style.background = '#444444');
        
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          
          if (éEditableDiv) {
            const selecao = window.getSelection();
            if (selecao.rangeCount > 0) {
              const rangeOriginal = selecao.getRangeAt(0);
              const noTexto = rangeOriginal.startContainer;

              // Cria a seleção cirúrgica no nó de texto para o execCommand substituir por cima
              if (noTexto && noTexto.nodeType === Node.TEXT_NODE) {
                const rangeSubstituicao = document.createRange();
                try {
                  rangeSubstituicao.setStart(noTexto, infoPalavraClicada.inicio);
                  rangeSubstituicao.setEnd(noTexto, infoPalavraClicada.fim);
                  
                  selecao.removeAllRanges();
                  selecao.addRange(rangeSubstituicao);
                } catch (err) {
                  console.warn("Mapeamento de nós falhou, aplicando fallback de foco.");
                }
              }
            }
          }

          //executa a substituição sem deixar emendas
          aplicarCorrecaoNoTexto(targetElement, textoCompleto, infoPalavraClicada.inicio, infoPalavraClicada.fim, sugestaoFormatada, éEditableDiv);
          popup.style.setProperty('display', 'none', 'important');
        });
        containerBotoes.appendChild(btn);
      });
    }
    popup.appendChild(containerBotoes);


    // POSICIONAMENTO DINAMICO ANTI-CORTE

    popup.style.setProperty('display', 'block', 'important');

    const larguraPopup = popup.offsetWidth || 240;
    const alturaPopup = popup.offsetHeight || 75;

    let topFinal = window.scrollY + rect.bottom + 6;
    let leftFinal = window.scrollX + rect.left;

    // Evita cortar na direita
    if (rect.left + larguraPopup > window.innerWidth) {
      leftFinal = window.scrollX + (window.innerWidth - larguraPopup - 20);
    }

    // Se bater no rodape ele joga para cima do campo
    if (rect.bottom + alturaPopup > window.innerHeight) {
      topFinal = window.scrollY + rect.top - alturaPopup - 6;
    }

    popup.style.setProperty('left', `${Math.max(5, leftFinal)}px`, 'important');
    popup.style.setProperty('top', `${Math.max(5, topFinal)}px`, 'important');
  });
}

//entende as mensagens do menu da extensão (Ativar/Desativar)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enable') isChecking = true;
  if (request.action === 'disable') {
    isChecking = false;
    popup.style.setProperty('display', 'none', 'important');
  }
  sendResponse({ success: true });
});