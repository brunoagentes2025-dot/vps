// ============================================================
//  LUNAR LANDER - suas configurações
//  Edite os números abaixo, salve e recarregue o lunar-lander.html
//  (este arquivo precisa ficar na mesma pasta do HTML).
//  Dica: regule pelos controles do jogo e clique em
//  "Copiar configuração" para colar aqui o resultado.
//  ATENÇÃO: o jogo também guarda seus ajustes automaticamente no
//  navegador, e esses valores salvos prevalecem sobre este arquivo.
//  Se editar este arquivo e nada mudar, clique em "Restaurar do config.js".
// ============================================================
window.LUNAR_CONFIG = {

  // ---- Os mesmos controles do menu do jogo ----
  gimbal: 20,            // inclinação máxima do bico, em graus (5 a 45)
  forca: 4.5,            // força do jato principal, m/s² (2 a 12)
  lateral: 2.5,          // força dos jatos laterais ← →, m/s² (0.5 a 8)
  gravidade: 1.6,        // gravidade da fase, m/s² (0.5 a 6). Lua = 1.6
  estabilizador: 60,     // ajuda para a nave não girar, % (0 = física pura)
  consumo: 1,            // multiplicador do gasto de combustível (0 a 3)
  inverterLaterais: false, // true troca o lado dos jatos ← →
  som: true,             // true liga o som

  // ---- Zoom da câmera (progressivo: muda continuamente, sem faixas) ----
  zoomPerto: 1.8,        // zoom máximo: perto do chão e parado (1 a 3)
  zoomLonge: 0.55,       // zoom mínimo: limite quando está alto e rápido (0.25 a 1)
  sensAltura: 40,        // sensibilidade à altura do chão, % (0 = ignora a altura)
  sensVelX: 30,          // sensibilidade à velocidade horizontal (x), %
  sensVelY: 30,          // sensibilidade à velocidade vertical (y), %
  rapidezZoom: 6,        // rapidez com que o zoom acompanha, % (1 a 30)
                         // dica: zoomPerto e zoomLonge iguais a 1 desligam o zoom

  // ---- Ajustes extras (só aqui no arquivo) ----
  tanque: 100,           // tamanho do tanque de combustível
  reabastecimento: 3.1,   // combustível recuperado por segundo na base
  gastoJato: 3,          // gasto por segundo do jato principal ligado
  gastoLateral: 1,       // gasto por segundo de cada jato lateral
  pousoVertMax: 3.2,     // velocidade vertical máxima no toque (m/s)
  pousoHorizMax: 19.2,    // velocidade horizontal máxima no toque (m/s)
  pousoAnguloMax: 90    // inclinação máxima no toque (graus)
};
