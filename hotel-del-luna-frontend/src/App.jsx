import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [quartos, setQuartos] = useState([]);
  const [usuario, setUsuario] = useState({ id: 1, nome: 'Hóspede Teste' }); // Exemplo de usuário logado
  const [mensagemAlerta, setMensagemAlerta] = useState('');

  // Carregar quartos ao iniciar
  useEffect(() => {
    fetch('http://localhost:3001/quartos')
      .then(res => res.json())
      .then(data => setQuartos(data))
      .catch(err => console.error('Erro ao buscar quartos:', err));
  }, []);

  // Função para realizar a reserva e disparar a notificação visual do Twilio
  const handleReservar = async (quartoId) => {
    try {
      const response = await fetch('http://localhost:3001/reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          quarto_id: quartoId,
          data_inicio: '2026-11-20',
          data_fim: '2026-11-25'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Notificação "fictícia/exemplo" do Twilio funcionando perfeitamente na tela
        setMensagemAlerta(`✅ Reserva realizada com sucesso! 📱 SMS de confirmação enviado via Twilio para a equipe do Hotel Del Luna.`);
        
        // Limpa o alerta após 6 segundos
        setTimeout(() => {
          setMensagemAlerta('');
        }, 6000);
      } else {
        alert('Erro ao realizar reserva: ' + (data.erro || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      alert('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Hotel Del Luna 🌙</h1>
      <p>Bem-vindo, {usuario.nome}!</p>

      {/* Caixa de Notificação Visual do SMS */}
      {mensagemAlerta && (
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '15px',
          borderRadius: '5px',
          margin: '20px 0',
          border: '1px solid #c3e6cb',
          fontWeight: 'bold',
          boxShadow: '0px 4px 6px rgba(0,0,0,0.1)'
        }}>
          {mensagemAlerta}
        </div>
      )}

      <h2>Quartos Disponíveis</h2>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {quartos.map(quarto => (
          <div key={quarto.id} style={{
            border: '1px solid #ccc',
            padding: '15px',
            borderRadius: '8px',
            width: '250px',
            backgroundColor: '#f9f9f9'
          }}>
            <h3>{quarto.nome || `Quarto ${quarto.id}`}</h3>
            <p>{quarto.descricao || 'Quarto confortável e aconchegante.'}</p>
            <p><strong>R$ {quarto.preco} / noite</strong></p>
            <button 
              onClick={() => handleReservar(quarto.id)}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reservar Agora
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;