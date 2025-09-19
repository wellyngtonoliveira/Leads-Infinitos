const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "dev-verify-token";

// ✅ Rota raiz
app.get("/", (req, res) => {
  res.send("🚀 Leads Infinitos está rodando com sucesso!");
});

// ✅ Rota de saúde
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ✅ Verificação do Webhook do WhatsApp
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ✅ Receber mensagens do WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || "";

    console.log("📩 Mensagem recebida:", from, "-", text);

    let reply;

    if (text.toLowerCase().includes("pizzaria")) {
      if (!process.env.GOOGLE_API_KEY) {
        reply = "Google API Key não configurada no .env";
      } else {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          text
        )}&key=${process.env.GOOGLE_API_KEY}`;

        const response = await axios.get(url);
        const results = response.data.results.slice(0, 5);

        if (results.length === 0) {
          reply = "Não encontrei resultados para sua busca.";
        } else {
          reply = "Aqui estão alguns resultados:\n\n";
          results.forEach((r, i) => {
            reply += `${i + 1}. ${r.name} - ${r.formatted_address}\n`;
          });
        }
      }
    } else {
      reply = `Você disse: ${text}`;
    }

    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
      await axios.post(
        `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
        }
      );
      console.log("✅ Resposta enviada ao WhatsApp");
    } else {
      console.log("ℹ️ Tokens não configurados, simulando resposta...");
      console.log("Resposta seria:", reply);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Erro no webhook:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
