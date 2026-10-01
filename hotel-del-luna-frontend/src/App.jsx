import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://del-luna-hotel.onrender.com';

function App() {
  const [aba, setAba] = useState('home');
  const [quartos, setQuartos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [minhasReservas, setMinhasReservas] = useState([]);
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [busca, setBusca] = useState('');
  
  // Estado para armazenar as respostas dinâmicas da IA recebidas do backend
  const [iaData, setIaData] = useState({});

  // Sistema de Notificações Customizadas
  const [notificacao, setNotificacao] = useState(null);

  const mostrarAviso = (mensagem, tipo = 'sucesso') => {
    setNotificacao({ mensagem, tipo });
    setTimeout(() => {
      setNotificacao(null);
    }, 3500);
  };

  // Autenticação com persistência no localStorage
  const [usuario, setUsuario] = useState(() => {
    const usuarioSalvo = localStorage.getItem('usuario_delluna');
    return usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
  });

  const [modalAuth, setModalAuth] = useState(false);
  const [modoCadastro, setModoCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Modal de Reserva
  const [quartoSelecionado, setQuartoSelecionado] = useState(null);
  const [dataCheckin, setDataCheckin] = useState('');
  const [dataCheckout, setDataCheckout] = useState('');
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState('');

  // Formulário Quarto (Admin)
  const [numero, setNumero] = useState('');
  const [tipo, setTipo] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [precoDiaria, setPrecoDiaria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [destaque, setDestaque] = useState(false);

  const carregarQuartos = async () => {
    try {
      const res = await fetch(`${API_URL}/quartos${busca ? `?tipo=${busca}` : ''}`);
      const data = await res.json();
      setQuartos(data);

      // Consulta REAL via Backend à API de IA para cada quarto carregado
      data.forEach(q => buscarInfoIA(q.id));
    } catch (err) {
      console.error(err);
    }
  };

  const buscarInfoIA = async (quartoId) => {
    try {
      const res = await fetch(`${API_URL}/quartos/${quartoId}/ia-info`);
      if (res.ok) {
        const data = await res.json();
        setIaData(prev => ({ ...prev, [quartoId]: data.iaInfo }));
      }
    } catch (err) {
      console.error("Erro ao buscar IA:", err);
    }
  };

  const carregarReservas = async () => {
    try {
      const res = await fetch(`${API_URL}/reservas`);
      const data = await res.json();
      setReservas(data);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarMinhasReservas = async () => {
    if (!usuario) return;
    try {
      const res = await fetch(`${API_URL}/reservas/usuario/${usuario.id}`);
      const data = await res.json();
      setMinhasReservas(data);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarUsuarios = async () => {
    try {
      const res = await fetch(`${API_URL}/usuarios`);
      if (res.ok) {
        const data = await res.json();
        setUsuariosLista(data);
        if (data.length > 0) {
          setUsuarioSelecionadoId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    carregarQuartos();
    if (aba === 'admin') carregarReservas();
    if (aba === 'minhas-reservas') carregarMinhasReservas();
    if (usuario && usuario.tipo === 'admin') carregarUsuarios();
  }, [aba, busca, usuario]);

  const handleClicarReservar = (quarto) => {
    if (!usuario) {
      mostrarAviso('Precisa de fazer login para realizar uma reserva!', 'erro');
      setModalAuth(true);
    } else {
      setQuartoSelecionado(quarto);
      if (usuario.tipo === 'admin' && usuariosLista.length > 0) {
        setUsuarioSelecionadoId(usuariosLista[0].id);
      } else {
        setUsuarioSelecionadoId(usuario.id);
      }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = modoCadastro ? '/cadastrar' : '/login';
    const bodyData = modoCadastro ? { nome, email, senha } : { email, senha };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();

      if (res.ok) {
        const userLogado = modoCadastro ? data : data.usuario;
        setUsuario(userLogado);
        localStorage.setItem('usuario_delluna', JSON.stringify(userLogado));
        setModalAuth(false);
        mostrarAviso(`Bem-vindo(a), ${userLogado.nome}!`, 'sucesso');
      } else {
        mostrarAviso(data.erro || 'Erro na autenticação.', 'erro');
      }
    } catch (err) {
      mostrarAviso('Erro ao conectar ao servidor.', 'erro');
    }
  };

  const handleLogout = () => {
    setUsuario(null);
    localStorage.removeItem('usuario_delluna');
    setAba('home');
    mostrarAviso('Sessão encerrada com sucesso.', 'sucesso');
  };

  const handleCriarReserva = async (e) => {
    e.preventDefault();
    if (!usuario) {
      mostrarAviso('Sessão expirada. Faça login novamente.', 'erro');
      setModalAuth(true);
      return;
    }

    const idDoHospede = usuario.tipo === 'admin' ? usuarioSelecionadoId : usuario.id;

    try {
      const res = await fetch(`${API_URL}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: idDoHospede,
          quarto_id: quartoSelecionado.id,
          data_checkin: dataCheckin,
          data_checkout: dataCheckout
        })
      });

      const errData = await res.json();

      if (res.ok) {
        mostrarAviso('Reserva efetuada com sucesso!', 'sucesso');
        setQuartoSelecionado(null);
        setDataCheckin('');
        setDataCheckout('');
        if (aba === 'admin') carregarReservas();
        if (aba === 'minhas-reservas') carregarMinhasReservas();
      } else {
        mostrarAviso(errData.erro || 'Erro ao realizar reserva.', 'erro');
      }
    } catch (err) {
      console.error(err);
      mostrarAviso('Erro de conexão ao criar reserva.', 'erro');
    }
  };

  const handleCadastrarQuarto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/quartos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero,
          tipo,
          capacidade: Number(capacidade),
          preco_diaria: Number(precoDiaria),
          descricao,
          imagem_url: imagemUrl,
          destaque
        })
      });

      if (res.ok) {
        mostrarAviso('Quarto cadastrado com sucesso!', 'sucesso');
        setNumero(''); setTipo(''); setCapacidade(''); setPrecoDiaria(''); setDescricao(''); setImagemUrl(''); setDestaque(false);
        carregarQuartos();
      }
    } catch (err) {
      console.error(err);
      mostrarAviso('Erro ao cadastrar quarto.', 'erro');
    }
  };

  const handleDeletarQuarto = async (id, num) => {
    if (window.confirm(`Tem certeza de que deseja excluir o Quarto ${num}?`)) {
      try {
        const res = await fetch(`${API_URL}/quartos/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (res.ok) {
          mostrarAviso('Quarto excluído com sucesso!', 'sucesso');
          carregarQuartos();
        } else {
          mostrarAviso(data.erro || 'Erro ao excluir quarto.', 'erro');
        }
      } catch (err) {
        console.error(err);
        mostrarAviso('Erro ao conectar ao servidor para excluir quarto.', 'erro');
      }
    }
  };

  const handleStatusReserva = async (id, novoStatus) => {
    try {
      await fetch(`${API_URL}/reservas/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus })
      });
      mostrarAviso(`Status atualizado para ${novoStatus.toUpperCase()}!`, 'sucesso');
      carregarReservas();
    } catch (err) {
      console.error(err);
      mostrarAviso('Erro ao atualizar status.', 'erro');
    }
  };

  const handleDeletarReserva = async (id) => {
    if (window.confirm(`Tem certeza de que deseja cancelar a reserva #${id}?`)) {
      try {
        const res = await fetch(`${API_URL}/reservas/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (res.ok) {
          mostrarAviso('Reserva cancelada com sucesso!', 'sucesso');
          if (aba === 'admin') carregarReservas();
          if (aba === 'minhas-reservas') carregarMinhasReservas();
        } else {
          mostrarAviso(data.erro || 'Erro ao excluir reserva.', 'erro');
        }
      } catch (err) {
        console.error(err);
        mostrarAviso('Erro ao conectar ao servidor.', 'erro');
      }
    }
  };

  return (
    <div>
      {/* Toast Notification Container */}
      {notificacao && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: notificacao.tipo === 'erro' ? '#c0392b' : '#1e272e',
            color: notificacao.tipo === 'erro' ? '#ffffff' : '#d4af37',
            border: `1px solid ${notificacao.tipo === 'erro' ? '#e74c3c' : '#d4af37'}`,
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            fontWeight: '600'
          }}
        >
          <span>{notificacao.tipo === 'erro' ? '⚠️' : '✨'}</span>
          <span>{notificacao.mensagem}</span>
        </div>
      )}

      <header className="header">
        <h1>🌙 HOTEL DEL LUNA</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {usuario ? (
            <>
              <span>Olá, <strong>{usuario.nome}</strong> ({usuario.tipo.toUpperCase()})</span>
              
              <button className="nav-btn" onClick={() => setAba('home')}>Vitrine</button>
              
              {usuario.tipo === 'cliente' && (
                <button className="nav-btn" onClick={() => setAba('minhas-reservas')}>
                  Minhas Reservas
                </button>
              )}

              {usuario.tipo === 'admin' && (
                <button className="nav-btn" onClick={() => setAba(aba === 'admin' ? 'home' : 'admin')}>
                  {aba === 'admin' ? 'Ver Vitrine' : 'Painel Admin'}
                </button>
              )}

              <button className="nav-btn" style={{ borderColor: '#c0392b', color: '#c0392b' }} onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <button className="nav-btn" onClick={() => setModalAuth(true)}>Entrar / Cadastrar</button>
          )}
        </div>
      </header>

      <main className="container">
        {aba === 'home' && (
          <div>
            <section className="hero">
              <h2>Acomodações Inesquecíveis</h2>
              <p>Encontre a suíte perfeita para a sua estadia no Hotel Del Luna</p>
              <div className="search-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar por tipo (ex: Deluxe, Standard)..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </section>

            <div className="quartos-grid">
              {quartos.map((quarto) => (
                <div key={quarto.id} className="quarto-card">
                  <img src={quarto.imagem_url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500'} alt={quarto.tipo} className="quarto-img" />
                  <div className="quarto-info">
                    {quarto.destaque && <span className="destaque-tag">Destaque</span>}
                    <h3>Quarto {quarto.numero} - {quarto.tipo}</h3>
                    <p><strong>Capacidade:</strong> {quarto.capacidade} pessoa(s)</p>
                    <p>{quarto.descricao}</p>

                    {/* 🌟 REQUISITO 3: Exibição dinamicamente obtida por IA */}
                    <div style={{
                      marginTop: '0.8rem',
                      marginBottom: '0.8rem',
                      padding: '0.7rem',
                      backgroundColor: 'rgba(212, 175, 55, 0.08)',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px',
                      fontSize: '0.8rem'
                    }}>
                      <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        ✨ Destaques da Suíte (via IA):
                      </p>
                      
                      <p style={{ color: '#ccc', margin: 0, whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                        {iaData[quarto.id] || "Consultando Inteligência Artificial..."}
                      </p>

                      <p style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic', marginTop: '0.4rem', textAlign: 'right', margin: 0 }}>
                        * Informações geradas por IA.
                      </p>
                    </div>

                    <div className="quarto-preco">R$ {Number(quarto.preco_diaria).toFixed(2)} / noite</div>
                    <button className="submit-btn" style={{ width: '100%' }} onClick={() => handleClicarReservar(quarto)}>
                      Reservar Agora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === 'minhas-reservas' && (
          <div>
            <section className="admin-section">
              <h2>Minhas Reservas</h2>
              {minhasReservas.length === 0 ? (
                <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem' }}>Você ainda não possui reservas efetuadas.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Quarto</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {minhasReservas.map((r) => (
                        <tr key={r.id}>
                          <td>#{r.id}</td>
                          <td>Quarto {r.quarto_numero} ({r.quarto_tipo})</td>
                          <td>{new Date(r.data_checkin).toLocaleDateString()}</td>
                          <td>{new Date(r.data_checkout).toLocaleDateString()}</td>
                          <td><span className={`badge ${r.status}`}>{r.status.toUpperCase()}</span></td>
                          <td style={{ display: 'flex', justifyContent: 'center' }}>
                            {r.status === 'reservado' ? (
                              <button 
                                className="action-btn" 
                                style={{ background: '#c0392b' }} 
                                onClick={() => handleDeletarReserva(r.id)}
                              >
                                Cancelar Reserva
                              </button>
                            ) : (
                              <span style={{ color: '#888', fontSize: '0.85rem' }}>Em andamento/Concluída</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {aba === 'admin' && (
          <div>
            {/* 📊 REQUISITO 9: Dashboard na Área Restrita com gráficos de Visão Geral do Sistema */}
            <section className="admin-section" style={{ marginBottom: '2rem' }}>
              <h2>Visão Geral do Sistema</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: '#1e272e', padding: '1.2rem', borderRadius: '8px', border: '1px solid #d4af37', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Nº de Clientes</span>
                  <h3 style={{ fontSize: '1.8rem', color: '#d4af37', margin: '0.3rem 0 0 0' }}>{usuariosLista.length}</h3>
                </div>
                <div style={{ background: '#1e272e', padding: '1.2rem', borderRadius: '8px', border: '1px solid #e74c3c', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Nº de Quartos</span>
                  <h3 style={{ fontSize: '1.8rem', color: '#e74c3c', margin: '0.3rem 0 0 0' }}>{quartos.length}</h3>
                </div>
                <div style={{ background: '#1e272e', padding: '1.2rem', borderRadius: '8px', border: '1px solid #2ecc71', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Nº de Reservas</span>
                  <h3 style={{ fontSize: '1.8rem', color: '#2ecc71', margin: '0.3rem 0 0 0' }}>{reservas.length}</h3>
                </div>
              </div>

              {/* Gráfico Visual de Estado das Reservas */}
              <div style={{ marginTop: '1.5rem', background: '#1e272e', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                <h4 style={{ color: '#d4af37', marginBottom: '0.8rem', fontSize: '0.95rem' }}>Estatísticas das Reservas (Status)</h4>
                
                <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', background: '#333' }}>
                  <div style={{ 
                    width: `${reservas.length ? (reservas.filter(r => r.status === 'reservado').length / reservas.length) * 100 : 0}%`, 
                    background: '#f39c12',
                    transition: 'width 0.5s ease-in-out'
                  }} title="Reservadas" />
                  <div style={{ 
                    width: `${reservas.length ? (reservas.filter(r => r.status === 'checkin').length / reservas.length) * 100 : 0}%`, 
                    background: '#2ecc71',
                    transition: 'width 0.5s ease-in-out'
                  }} title="Check-in" />
                  <div style={{ 
                    width: `${reservas.length ? (reservas.filter(r => r.status === 'checkout').length / reservas.length) * 100 : 0}%`, 
                    background: '#3498db',
                    transition: 'width 0.5s ease-in-out'
                  }} title="Check-out" />
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.8rem', fontSize: '0.85rem', color: '#ccc', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>🟡 Reservadas: <strong>{reservas.filter(r => r.status === 'reservado').length}</strong></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>🟢 Check-in: <strong>{reservas.filter(r => r.status === 'checkin').length}</strong></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>🔵 Check-out: <strong>{reservas.filter(r => r.status === 'checkout').length}</strong></span>
                </div>
              </div>
            </section>

            <section className="admin-section">
              <h2>Cadastrar Novo Quarto</h2>
              <form onSubmit={handleCadastrarQuarto}>
                <div className="form-group">
                  <input className="form-input" placeholder="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
                  <input className="form-input" placeholder="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} required />
                  <input className="form-input" type="number" placeholder="Capacidade" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} required />
                  <input className="form-input" type="number" step="0.01" placeholder="Diária (R$)" value={precoDiaria} onChange={(e) => setPrecoDiaria(e.target.value)} required />
                </div>
                <div className="form-group">
                  <input className="form-input" placeholder="URL da Foto" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                    <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} /> Exibir em Destaque
                  </label>
                </div>
                <div className="form-group">
                  <input className="form-input" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                </div>
                <button type="submit" className="submit-btn">Cadastrar Quarto</button>
              </form>
            </section>

            <section className="admin-section">
              <h2>Quartos Cadastrados</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Número</th>
                      <th>Tipo</th>
                      <th>Capacidade</th>
                      <th>Diária</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quartos.map((q) => (
                      <tr key={q.id}>
                        <td>#{q.id}</td>
                        <td>{q.numero}</td>
                        <td>{q.tipo}</td>
                        <td>{q.capacidade} p.</td>
                        <td>R$ {Number(q.preco_diaria).toFixed(2)}</td>
                        <td style={{ display: 'flex', justifyContent: 'center' }}>
                          <button 
                            className="action-btn" 
                            style={{ background: '#c0392b' }} 
                            onClick={() => handleDeletarQuarto(q.id, q.numero)}
                          >
                            Excluir Quarto
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-section">
              <h2>Gestão de Reservas</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Hóspede</th>
                      <th>Quarto</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map((r) => (
                      <tr key={r.id}>
                        <td>#{r.id}</td>
                        <td>{r.hospede_nome}</td>
                        <td>{r.quarto_numero} ({r.quarto_tipo})</td>
                        <td>{new Date(r.data_checkin).toLocaleDateString()}</td>
                        <td>{new Date(r.data_checkout).toLocaleDateString()}</td>
                        <td><span className={`badge ${r.status}`}>{r.status.toUpperCase()}</span></td>
                        <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                          {r.status === 'reservado' && (
                            <button className="action-btn btn-checkin" onClick={() => handleStatusReserva(r.id, 'checkin')}>Check-in</button>
                          )}
                          {r.status === 'checkin' && (
                            <button className="action-btn btn-checkout" onClick={() => handleStatusReserva(r.id, 'checkout')}>Check-out</button>
                          )}
                          
                          <button 
                            className="action-btn" 
                            style={{ background: '#c0392b' }} 
                            onClick={() => handleDeletarReserva(r.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {modalAuth && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{modoCadastro ? 'Criar Conta' : 'Acessar Conta'}</h2>
            <form onSubmit={handleAuth}>
              {modoCadastro && (
                <input className="form-input" style={{ width: '100%', marginBottom: '1rem' }} placeholder="Seu Nome Completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
              )}
              <input className="form-input" style={{ width: '100%', marginBottom: '1rem' }} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className="form-input" style={{ width: '100%', marginBottom: '1rem' }} type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              <button type="submit" className="submit-btn" style={{ width: '100%' }}>
                {modoCadastro ? 'Cadastrar' : 'Entrar'}
              </button>
            </form>
            <p style={{ marginTop: '1rem', textAlign: 'center', cursor: 'pointer', color: 'var(--accent-gold)' }} onClick={() => setModoCadastro(!modoCadastro)}>
              {modoCadastro ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
            </p>
            <button className="action-btn" style={{ width: '100%', marginTop: '0.5rem', background: '#555' }} onClick={() => setModalAuth(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {quartoSelecionado && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Reservar Quarto {quartoSelecionado.numero}</h2>
            <p style={{ marginBottom: '1rem', color: 'var(--accent-gold)' }}>{quartoSelecionado.tipo} - R$ {quartoSelecionado.preco_diaria} / noite</p>
            
            <form onSubmit={handleCriarReserva}>
              {usuario.tipo === 'admin' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Selecionar Hóspede:</label>
                  <select 
                    className="form-input" 
                    style={{ width: '100%' }}
                    value={usuarioSelecionadoId} 
                    onChange={(e) => setUsuarioSelecionadoId(e.target.value)}
                    required
                  >
                    {usuariosLista.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Data Check-in:</label>
              <input type="date" className="form-input" style={{ width: '100%', marginBottom: '1rem' }} value={dataCheckin} onChange={(e) => setDataCheckin(e.target.value)} required />
              
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Data Check-out:</label>
              <input type="date" className="form-input" style={{ width: '100%', marginBottom: '1rem' }} value={dataCheckout} onChange={(e) => setDataCheckout(e.target.value)} required />

              <button type="submit" className="submit-btn" style={{ width: '100%' }}>Confirmar Reserva</button>
            </form>
            <button className="action-btn" style={{ width: '100%', marginTop: '0.5rem', background: '#555' }} onClick={() => setQuartoSelecionado(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;