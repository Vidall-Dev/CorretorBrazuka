// Mantém o Service Worker acordado
chrome.alarms.create('manterVivo', { periodInMinutes: 0.3 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'manterVivo') console.log('Conexão com API ativa.');
});

const API_URL = "https://api.languagetool.org/v2/check";


//ATALHOS RÁPIDOS PARA PALAVRAS CURTAS
const dicionarioAtalhos = {
  "di": ["de", "dia"],
  "eta": ["esta", "está", "eita"],
  "tbm": ["também"],
  "vc": ["você"],
  "oq": ["o que"],
  "nao": ["não"],
  "q": ["que"],
  "pq": ["porque", "por que"]
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analisarTexto') {
    const { texto, posicao } = request;

    if (!texto) {
      sendResponse({ tipo: 'invalido' });
      return false; 
    }

    //ISOLA A PALAVRA CLICADA LOCALMENTE ANTES DE CHAMAR A API
    let inicioPalavra = posicao;
    let fimPalavra = posicao;
    const regexLetra = /[a-zA-ZáàâãéèêíïóôõúçÁÀÂÃÉÈÊÍÏÓÔÕÚÇ]/;

    // Anda para trás para achar o começo da palavra
    while (inicioPalavra > 0 && regexLetra.test(texto[inicioPalavra - 1])) {
      inicioPalavra--;
    }
    // Anda para frente para achar o fim da palavra
    while (fimPalavra < texto.length && regexLetra.test(texto[fimPalavra])) {
      fimPalavra++;
    }

    const palavraClicada = texto.slice(inicioPalavra, fimPalavra);
    const palavraMinuscula = palavraClicada.toLowerCase();

    //VERIFICAÇÃO NA LISTA DE ATALHOS
    if (dicionarioAtalhos.hasOwnProperty(palavraMinuscula)) {
      console.log(`⚡ Atalho local ativado para: ${palavraClicada}`);
      sendResponse({
        tipo: 'erro_detectado',
        palavra: palavraClicada,
        mensagem: "Sugestão de correção rápida",
        sugestoes: dicionarioAtalhos[palavraMinuscula],
        inicio: inicioPalavra,
        fim: fimPalavra
      });
      return false;
    }

    //SE NÃO FOR UM ATALHO CURT SEGUE PARA A API DO LANGUAGETOOL
    const params = new URLSearchParams();
    params.append('text', texto);
    params.append('language', 'pt-BR');

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })
    .then(response => {
      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      return response.json();
    })
    .then(data => {
      const matches = data.matches || [];

      const erroEncontrado = matches.find(item => {
        const inicioErro = item.offset;
        const fimErro = item.offset + item.length;
        return posicao >= inicioErro && posicao <= fimErro;
      });

      if (erroEncontrado) {
        const palavraErrada = texto.slice(erroEncontrado.offset, erroEncontrado.offset + erroEncontrado.length);
        const listaSugestoes = (erroEncontrado.replacements || []).map(r => r.value);

        sendResponse({
          tipo: 'erro_detectado',
          palavra: palavraErrada,
          mensagem: erroEncontrado.message,
          sugestoes: listaSugestoes.slice(0, 5),
          inicio: erroEncontrado.offset,
          fim: erroEncontrado.offset + erroEncontrado.length
        });
      } else {
        sendResponse({ tipo: 'correto' });
      }
    })
    .catch(err => {
      console.error("Falha na API LanguageTool:", err.message);
      sendResponse({ tipo: 'invalido' });
    });

    return true; 
  }
});