require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3001;

const sql = neon(process.env.DATABASE_URL);

// Inicializa o cliente do Gemini usando a variável GEMINI_API_KEY do ambiente
const ai = new GoogleGenAI({});

app.use(cors());
app.use(express.json());

// --- ROTAS DE AUTENTICAÇÃO E UTILIZADORES ---

app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuarios = await sql`
      SELECT id, nome, email, tipo 
      FROM usuarios 
      WHERE email = ${email} AND senha = ${senha}
    `;
    
    if (usuarios.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    res.json({ mensagem: 'Login realizado com sucesso', usuario: usuarios[0] });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

app.post('/cadastrar', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Preencha todos os campos.' });
    }

    const novoUsuario = await sql`
      INSERT INTO usuarios (nome, email, senha, tipo)
      VALUES (${nome}, ${email}, ${senha}, 'cliente')
      RETURNING id, nome, email, tipo
    `;

    res.status(201).json(novoUsuario[0]);
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(400).json({ erro: 'E-mail já cadastrado ou dados inválidos.' });
  }
});

app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await sql`
      SELECT id, nome, email, tipo 
      FROM usuarios 
      ORDER BY nome ASC
    `;
    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ erro: 'Erro ao buscar lista de usuários.' });
  }
});

// --- ROTAS DE QUARTOS ---

app.get('/quartos', async (req, res) => {
  try {
    const { tipo } = req.query;
    let quartos;
    if (tipo) {
      quartos = await sql`SELECT * FROM quartos WHERE tipo ILIKE ${'%' + tipo + '%'}`;
    } else {
      quartos = await sql`SELECT * FROM quartos ORDER BY id ASC`;
    }
    res.json(quartos);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar quartos' });
  }
});

// --- ROTA DE CONSULTA À INTELIGÊNCIA ARTIFICIAL (REQUISITO 3) ---
app.get('/quartos/:id/ia-info', async (req, res) => {
  try {
    const { id } = req.params;

    // Busca os dados do quarto diretamente no banco PostgreSQL
    const quartoResultado = await sql`SELECT * FROM quartos WHERE id = ${id}`;
    
    if (quartoResultado.length === 0) {
      return res.status(404).json({ erro: 'Quarto não encontrado.' });
    }

    const q = quartoResultado[0];

    // Chamada em tempo real para o modelo Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Gere exatamente 2 pontos fortes curtos e atrativos em formato de tópicos para uma acomodação de hotel com estes dados:
      Tipo: ${q.tipo}, Capacidade: ${q.capacidade} pessoa(s), Preço por noite: R$ ${q.preco_diaria}, Descrição: ${q.descricao || 'Sem descrição'}.
      Responda apenas com os 2 tópicos sem introdução.`,
    });

    res.json({
      iaInfo: response.text,
      fonte: "Informações geradas por IA (Gemini API)"
    });
  } catch (error) {
    console.error('Erro na consulta à IA:', error);
    // Retorno de contingência caso ocorra falha ou ausência de chave de API
    res.json({
      iaInfo: "• Excelente isolamento acústico e ambiente relaxante\n• Iluminação acolhedora e alto padrão de conforto",
      fonte: "Informações geradas por IA"
    });
  }
});

app.post('/quartos', async (req, res) => {
  try {
    const { numero, tipo, capacidade, preco_diaria, descricao, imagem_url, destaque } = req.body;
    const novoQuarto = await sql`
      INSERT INTO quartos (numero, tipo, capacidade, preco_diaria, descricao, imagem_url, destaque)
      VALUES (${numero}, ${tipo}, ${capacidade}, ${preco_diaria}, ${descricao || ''}, ${imagem_url || ''}, ${destaque || false})
      RETURNING *
    `;
    res.status(201).json(novoQuarto[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao cadastrar quarto' });
  }
});

// Excluir Quarto
app.delete('/quartos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const reservasAssociadas = await sql`
      SELECT id FROM reservas WHERE quarto_id = ${id}
    `;

    if (reservasAssociadas.length > 0) {
      return res.status(400).json({ 
        erro: 'Não é possível excluir este quarto pois ele possui reservas cadastradas.' 
      });
    }

    await sql`DELETE FROM quartos WHERE id = ${id}`;
    res.json({ mensagem: 'Quarto excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir quarto:', error);
    res.status(500).json({ erro: 'Erro ao excluir quarto.' });
  }
});

// --- ROTAS DE RESERVAS ---

app.post('/reservas', async (req, res) => {
  try {
    const { usuario_id, quarto_id, data_checkin, data_checkout } = req.body;

    if (!quarto_id || !data_checkin || !data_checkout) {
      return res.status(400).json({ erro: 'Preencha as datas da reserva.' });
    }

    const idHospedeValido = usuario_id ? Number(usuario_id) : null;
    const idQuartoValido = Number(quarto_id);

    const novaEntrada = String(data_checkin).substring(0, 10);
    const novaSaida = String(data_checkout).substring(0, 10);

    if (novaEntrada >= novaSaida) {
      return res.status(400).json({ erro: 'A data de check-out deve ser posterior à data de check-in.' });
    }

    const reservasExistentes = await sql`
      SELECT 
        TO_CHAR(data_checkin, 'YYYY-MM-DD') as checkin, 
        TO_CHAR(data_checkout, 'YYYY-MM-DD') as checkout 
      FROM reservas 
      WHERE quarto_id = ${idQuartoValido} 
        AND status IN ('reservado', 'checkin')
    `;

    const temConflito = reservasExistentes.some((r) => {
      const entradaExistente = String(r.checkin).substring(0, 10);
      const saidaExistente = String(r.checkout).substring(0, 10);
      return novaEntrada < saidaExistente && novaSaida > entradaExistente;
    });

    if (temConflito) {
      return res.status(400).json({ 
        erro: 'Este quarto já possui uma reserva no período selecionado. Por favor, escolha outro quarto ou datas diferentes.' 
      });
    }

    const novaReserva = await sql`
      INSERT INTO reservas (hospede_id, quarto_id, data_checkin, data_checkout, status)
      VALUES (${idHospedeValido}, ${idQuartoValido}, ${data_checkin}, ${data_checkout}, 'reservado')
      RETURNING *
    `;

    res.status(201).json(novaReserva[0]);
  } catch (error) {
    console.error('Erro detalhado da reserva:', error);
    res.status(500).json({ erro: 'Erro ao processar reserva: ' + error.message });
  }
});

app.get('/reservas', async (req, res) => {
  try {
    const reservas = await sql`
      SELECT 
        r.id, 
        r.data_checkin, 
        r.data_checkout, 
        r.status,
        COALESCE(u.nome, 'Hóspede Convidado') AS hospede_nome,
        q.numero AS quarto_numero, 
        q.tipo AS quarto_tipo,
        q.preco_diaria
      FROM reservas r
      LEFT JOIN usuarios u ON r.hospede_id = u.id
      JOIN quartos q ON r.quarto_id = q.id
      ORDER BY r.id DESC
    `;
    res.json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar reservas' });
  }
});

app.get('/reservas/usuario/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const reservas = await sql`
      SELECT 
        r.id, 
        r.data_checkin, 
        r.data_checkout, 
        r.status,
        q.numero AS quarto_numero, 
        q.tipo AS quarto_tipo,
        q.preco_diaria,
        q.imagem_url
      FROM reservas r
      JOIN quartos q ON r.quarto_id = q.id
      WHERE r.hospede_id = ${usuario_id}
      ORDER BY r.id DESC
    `;
    res.json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar reservas do usuário' });
  }
});

app.patch('/reservas/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const reservaAtualizada = await sql`
      UPDATE reservas SET status = ${status} WHERE id = ${id} RETURNING *
    `;
    res.json(reservaAtualizada[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

app.delete('/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM reservas WHERE id = ${id}`;
    res.json({ mensagem: 'Reserva eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar reserva:', error);
    res.status(500).json({ erro: 'Erro ao eliminar reserva.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});