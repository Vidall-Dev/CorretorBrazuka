document.addEventListener('DOMContentLoaded', async () => {
  const wordCountEl = document.getElementById('word-count');
  const toggleBtn = document.getElementById('toggle-btn');

  // Recupera o estado salvo do corretor (padrão: true / Ativado)
  chrome.storage.local.get({ corretorAtivo: true }, async (result) => {
    const ativo = result.corretorAtivo;
    atualizarBotaoVisual(ativo);
    
    // Comunica o estado inicial para a aba ativa
    enviarMensagemParaAbaAtiva({ action: ativo ? 'enable' : 'disable' });
  });

  // Busca o total de palavras do dicionário que está rodando no content.js da página
  try {
    const resposta = await enviarMensagemParaAbaAtiva({ action: 'getWordCount' });
    if (resposta && resposta.count) {
      // Formata o número com pontos de milhar (ex: 49.521)
      wordCountEl.innerText = resposta.count.toLocaleString('pt-BR');
    } else {
      wordCountEl.innerText = "Erro ao ler";
    }
  } catch (error) {
    wordCountEl.innerText = "Abra um site para ver";
  }

  // Evento de clique para ligar/desligar o corretor
  toggleBtn.addEventListener('click', () => {
    chrome.storage.local.get({ corretorAtivo: true }, (result) => {
      const novoEstado = !result.corretorAtivo;
      
      // Salva a nova configuração
      chrome.storage.local.set({ corretorAtivo: novoEstado }, () => {
        atualizarBotaoVisual(novoEstado);
        // Avisa o content.js da página para ativar ou desativar o clique
        enviarMensagemParaAbaAtiva({ action: novoEstado ? 'enable' : 'disable' });
      });
    });
  });

  // Função auxiliar para mudar a cor e texto do botão
  function atualizarBotaoVisual(ativo) {
    if (ativo) {
      toggleBtn.innerText = 'Ativado';
      toggleBtn.className = 'btn btn-enabled';
    } else {
      toggleBtn.innerText = 'Desativado';
      toggleBtn.className = 'btn btn-disabled';
    }
  }

  // Função auxiliar para mandar dados do Pop-up para a Página Web ativa
  async function enviarMensagemParaAbaAtiva(mensagem) {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!aba) return null;
    
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(aba.id, mensagem, (response) => {
        // Ignora erros de abas onde o script não pode injetar (ex: chrome://)
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }
});