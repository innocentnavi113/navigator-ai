export default function TermsPage() {
  const s = {
    page: { minHeight: '100vh', background: '#050505', color: '#f0f0f0', fontFamily: "'JetBrains Mono', monospace", position: 'relative', zIndex: 10 },
    nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', borderBottom: '1px solid rgba(255,42,42,0.15)', background: '#050505' },
    logo: { fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.1em', cursor: 'pointer', color: '#ff2a2a', textShadow: '0 0 8px #ff2a2a' },
    back: { background: 'none', border: '1px solid rgba(255,42,42,0.3)', color: '#888', padding: '8px 16px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' },
    main: { maxWidth: 760, margin: '0 auto', padding: '60px 24px 80px' },
    eyebrow: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.25em', color: '#ff2a2a', marginBottom: 16, fontWeight: 800, textTransform: 'uppercase' },
    h1: { fontSize: '1.8rem', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.2, letterSpacing: '0.03em', textTransform: 'uppercase' },
    meta: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: '#444', marginBottom: 52, letterSpacing: '0.05em' },
    card: { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '28px 32px', marginBottom: 24 },
    riskCard: { background: 'rgba(255,42,42,0.05)', border: '1px solid rgba(255,42,42,0.3)', borderRadius: 12, padding: '28px 32px', marginBottom: 24 },
    h2: { fontSize: '0.82rem', fontWeight: 800, margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f0f0f0' },
    riskH2: { fontSize: '0.82rem', fontWeight: 800, margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid rgba(255,42,42,0.25)', color: '#ff2a2a', letterSpacing: '0.12em', textTransform: 'uppercase' },
    p: { fontSize: '0.72rem', lineHeight: 1.85, color: '#999', margin: '0 0 10px', letterSpacing: '0.02em' },
    contact: { background: 'rgba(255,42,42,0.05)', border: '1px solid rgba(255,42,42,0.25)', borderRadius: 12, padding: '24px 32px', fontSize: '0.7rem', color: '#888', lineHeight: 1.8, letterSpacing: '0.02em' },
    footer: { borderTop: '1px solid rgba(255,42,42,0.15)', padding: '32px 24px 48px', textAlign: 'center' },
    disclaimer: { fontSize: '0.65rem', color: '#666', maxWidth: 560, margin: '0 auto 10px', lineHeight: 1.7, letterSpacing: '0.03em' },
    copy: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' },
  }

  const goHome = () => { window.location.href = '/' }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.logo} onClick={goHome}>◎ NAVIGATOR AI</div>
        <button style={s.back} onClick={goHome}>← Back</button>
      </nav>

      <div style={s.main}>
        <div style={s.eyebrow}>LEGAL</div>
        <h1 style={s.h1}>Terms of Service &amp; Risk Disclaimer</h1>
        <p style={s.meta}>Last Updated: 8 June 2026 · Innocent Traders · South Africa</p>

        <div style={s.card}>
          <h2 style={s.h2}>1. The Service Provided</h2>
          <p style={s.p}>1.1. Innocent Traders ("Software Provider", "we", "us") develops and sells Navigator AI Chart Analysis Tool ("the Software", "Navigator AI").</p>
          <p style={s.p}>1.2. The Software is a technical utility that analyzes uploaded MT4/MT5 chart screenshots and outputs AI-generated technical observations. This includes identification of chart patterns, support/resistance levels, and market structure.</p>
          <p style={{...s.p, marginBottom: 0}}>1.3. The Software Provider does not manage client trading accounts, hold client funds, connect to broker APIs, or execute trades. The Software does not issue buy/sell recommendations, signals, or alerts.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>2. No Financial Services Provider Relationship</h2>
          <p style={s.p}>2.1. The Client acknowledges that the Software Provider is <strong style={{color: '#f0f0f0'}}>not</strong> a registered Financial Services Provider under the Financial Advisory and Intermediary Services Act of South Africa.</p>
          <p style={s.p}>2.2. The Software is an automated analytical tool intended purely for informational, educational, and technical assistance. All trading and investment decisions are made solely by the Client.</p>
          <p style={{...s.p, marginBottom: 0}}>2.3. Nothing on this website or within the Software constitutes financial, investment, tax, or trading advice.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>3. User Eligibility &amp; Account Responsibility</h2>
          <p style={s.p}>3.1. You must be 18 years of age or older to purchase a license.</p>
          <p style={{...s.p, marginBottom: 0}}>3.2. You are responsible for maintaining the confidentiality of your account login and for all activity under your account.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>4. License Grant &amp; Restrictions</h2>
          <p style={s.p}>4.1. Upon payment, we grant you a limited, non-exclusive, non-transferable license to use Navigator AI for personal use only.</p>
          <p style={{...s.p, marginBottom: 0}}>4.2. You may not resell, redistribute, reverse-engineer, or share your license.</p>
        </div>

        <div style={s.riskCard}>
          <h2 style={s.riskH2}>⚠️ 5. Risk Warning &amp; No Guarantees</h2>
          <p style={s.p}>5.1. <strong style={{color: '#f0f0f0'}}>High-Risk Warning:</strong> Trading foreign exchange, derivatives, and financial markets carries a high level of risk and may not be suitable for all investors. You could lose some or all of your invested capital.</p>
          <p style={s.p}>5.2. <strong style={{color: '#f0f0f0'}}>No Guarantees:</strong> The Software Provider makes no promises, guarantees, or representations regarding potential profits, income, or trading success. Past performance of any market or analysis method does not guarantee future results.</p>
          <p style={{...s.p, marginBottom: 0}}>5.3. <strong style={{color: '#f0f0f0'}}>Assumption of Risk:</strong> The Client uses the Software entirely at their own risk. The Software Provider is not liable for any financial losses, account wipeouts, or damages resulting from the use of the Software or reliance on its output.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>6. Fees and Strict No-Refund Policy</h2>
          <p style={s.p}>6.1. All payments made for the Software, software licenses, or digital access are final.</p>
          <p style={s.p}>6.2. Due to the digital nature of software delivery and intellectual property, <strong style={{color: '#f0f0f0'}}>no refunds will be issued under any circumstances</strong>, including but not limited to: market losses, changes in the Client's financial situation, technical incompatibility, or buyer's remorse.</p>
          <p style={{...s.p, marginBottom: 0}}>6.3. Chargebacks initiated after accessing the Software will be contested with this agreement as evidence.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>7. Limitation of Liability</h2>
          <p style={{...s.p, marginBottom: 0}}>7.1. To the maximum extent permitted by law, Innocent Traders shall not be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use the Software.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>8. Governing Law</h2>
          <p style={{...s.p, marginBottom: 0}}>8.1. This Agreement is governed by the laws of the Republic of South Africa. Any disputes will be handled through civil channels in South Africa.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>9. Acceptance of Terms</h2>
          <p style={{...s.p, marginBottom: 0}}>9.1. By purchasing, accessing, or using Navigator AI, you confirm that you have read, understood, and accept all the terms, risk warnings, and the no-refund policy stated in this agreement.</p>
        </div>

        <div style={s.contact}>
          <p style={{margin: '0 0 6px'}}><strong style={{color: '#ff2a2a'}}>Contact:</strong> Innocent Traders · South Africa</p>
          <p style={{margin: 0}}>For queries regarding these terms, reach out via the contact details provided at point of purchase.</p>
        </div>
      </div>

      <footer style={s.footer}>
        <p style={s.disclaimer}>Chart analysis for educational purposes only. Not financial advice. Trading carries significant risk. Always manage your risk.</p>
        <p style={s.copy}>© 2026 Navigator AI · Innocent Traders · South Africa</p>
      </footer>
    </div>
  )
}
