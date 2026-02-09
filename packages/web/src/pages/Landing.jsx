import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SCORE_TIERS } from '@stillnoob/shared';

export default function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [charName, setCharName] = useState('');
  const [realm, setRealm] = useState('');
  const [region, setRegion] = useState('EU');
  const [searching, setSearching] = useState(false);

  function handleAnalyze(e) {
    e.preventDefault();
    const name = charName.trim();
    const realmSlug = realm.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || !realmSlug) return;
    setSearching(true);
    navigate(`/character/${region.toLowerCase()}/${realmSlug}/${name}`);
  }

  return (
    <div className="min-h-screen bg-void-deep relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 animate-void-drift">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_600px_at_20%_30%,rgba(123,47,242,0.15),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_800px_400px_at_80%_20%,rgba(157,92,255,0.08),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_500px_at_60%_80%,rgba(123,47,242,0.1),transparent_70%)]" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 px-6 md:px-12 h-14 flex items-center justify-between bg-gradient-to-b from-void-deep/95 to-transparent backdrop-blur-sm">
        <span className="font-cinzel text-xl font-bold bg-gradient-to-r from-void-accent to-sunwell-gold bg-clip-text text-transparent">
          StillNoob
        </span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-void-secondary hover:text-white transition-colors">
            {t('auth.login')}
          </Link>
          <Link
            to="/register"
            className="px-4 py-1.5 bg-void-bright hover:bg-void-glow text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {t('auth.register')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-void-glow/30 rounded-full text-xs font-semibold tracking-widest uppercase text-void-accent bg-void-glow/8 mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 bg-fel-green rounded-full animate-pulse" />
          Ready for Midnight Season 1
        </div>

        <h1 className="font-cinzel font-black leading-none mb-4 animate-fade-in" style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)' }}>
          <span className="block text-white" style={{ textShadow: '0 0 60px rgba(123,47,242,0.3)' }}>
            Are You Still
          </span>
          <span className="block bg-gradient-to-r from-void-bright via-sunwell-gold to-void-accent bg-clip-text text-transparent animate-shimmer bg-[length:200%_200%]">
            A Noob?
          </span>
        </h1>

        <p className="text-lg md:text-xl text-void-secondary font-light max-w-xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Drop your character name. We'll analyze your logs, gear, and gameplay — then tell you{' '}
          <strong className="text-white font-semibold">exactly</strong> how to improve.
        </p>

        {/* Search Box */}
        <form onSubmit={handleAnalyze} className="w-full max-w-2xl animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex flex-col sm:flex-row bg-void-surface border border-void-glow/25 rounded-2xl overflow-hidden focus-within:border-void-glow focus-within:shadow-[0_0_30px_rgba(123,47,242,0.2)] transition-all">
            <div className="flex-[2] relative border-b sm:border-b-0 sm:border-r border-void-glow/20">
              <label className="absolute top-2 left-4 text-[10px] font-bold tracking-widest uppercase text-void-muted">
                Character Name
              </label>
              <input
                type="text"
                placeholder="Thrall"
                value={charName}
                onChange={e => setCharName(e.target.value)}
                className="w-full pt-7 pb-3 px-4 bg-transparent text-white font-rajdhani text-base outline-none placeholder:text-void-muted/50"
              />
            </div>
            <div className="flex-1 relative border-b sm:border-b-0 sm:border-r border-void-glow/20">
              <label className="absolute top-2 left-4 text-[10px] font-bold tracking-widest uppercase text-void-muted">
                Realm
              </label>
              <input
                type="text"
                placeholder="Ragnaros"
                value={realm}
                onChange={e => setRealm(e.target.value)}
                className="w-full pt-7 pb-3 px-4 bg-transparent text-white font-rajdhani text-base outline-none placeholder:text-void-muted/50"
              />
            </div>
            <div className="flex-1 relative border-b sm:border-b-0 sm:border-r border-void-glow/20">
              <label className="absolute top-2 left-4 text-[10px] font-bold tracking-widest uppercase text-void-muted">
                Region
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full pt-7 pb-3 px-4 bg-transparent text-white font-rajdhani text-base outline-none appearance-none cursor-pointer"
              >
                <option className="bg-void-mid" value="EU">EU</option>
                <option className="bg-void-mid" value="US">US</option>
                <option className="bg-void-mid" value="KR">KR</option>
                <option className="bg-void-mid" value="TW">TW</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-8 py-4 sm:py-0 bg-gradient-to-r from-void-glow to-void-bright text-white font-cinzel font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_30px_rgba(123,47,242,0.4)] transition-all disabled:opacity-60"
            >
              {searching ? 'Analyzing...' : 'Analyze Me'}
            </button>
          </div>
          <p className="mt-3 text-sm text-void-muted">
            We pull data from <span className="text-void-accent">WarcraftLogs</span>,{' '}
            <span className="text-void-accent">Raider.io</span>, and the{' '}
            <span className="text-void-accent">Armory</span>
          </p>
        </form>

        {/* Score tier badges */}
        <div className="flex flex-wrap justify-center gap-3 mt-10 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          {SCORE_TIERS.map((tier) => (
            <div
              key={tier.key}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide border opacity-70 hover:opacity-100 hover:-translate-y-0.5 transition-all"
              style={{
                color: tier.color,
                borderColor: `${tier.color}40`,
                backgroundColor: `${tier.color}10`,
              }}
            >
              {tier.label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl font-bold text-white mb-3">What We Analyze</h2>
          <p className="text-void-secondary text-lg">Your full character breakdown in seconds — not just data, but answers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: 'fa-chart-line',
              color: '#0096ff',
              title: 'Performance Stats',
              desc: 'Your real numbers compared to players of your class, spec, and item level.',
              items: ['DPS/HPS ranking vs your ilvl bracket', 'Parse percentiles across all your kills', 'Week-over-week progression tracking'],
            },
            {
              icon: 'fa-crosshairs',
              color: '#f6c843',
              title: 'Gear & Consumables',
              desc: 'Flask uptime, potion usage, food buffs, and consumable optimization.',
              items: ['Combat potion & flask tracking', 'Healthstone and health potion usage', 'Consumable score per fight'],
            },
            {
              icon: 'fa-lightbulb',
              color: '#00ff88',
              title: 'Personal Coaching',
              desc: 'We read your logs like a coach watching your gameplay. Actionable tips, not raw data.',
              items: ['Survivability analysis with specific fixes', 'Interrupt & dispel benchmarks', 'Cooldown timing optimization'],
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-7 rounded-2xl bg-gradient-to-br from-void-surface/80 to-void-mid/90 border border-void-bright/12 hover:border-void-bright/30 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(123,47,242,0.1)] transition-all group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg mb-5"
                style={{
                  background: `linear-gradient(135deg, ${f.color}20, ${f.color}08)`,
                  border: `1px solid ${f.color}30`,
                }}
              >
                <i className={`fas ${f.icon}`} style={{ color: f.color }} />
              </div>
              <h3 className="font-cinzel text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-void-secondary mb-4">{f.desc}</p>
              <div className="space-y-2">
                {f.items.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs text-void-secondary py-1.5 px-3 bg-void-glow/5 rounded-lg border-l-2 border-void-glow">
                    <span className="text-void-accent">→</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Coaching Preview */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="font-cinzel text-3xl font-bold text-white mb-3">Your Personal Coach Speaks</h2>
          <p className="text-void-secondary text-lg">This is what your dashboard looks like. Real feedback, not just numbers.</p>
        </div>

        <div className="space-y-3">
          {[
            { type: 'danger', icon: '🔴', title: "You're eating avoidable damage", msg: 'You took 340k avoidable damage on Voidspire Council — that\'s 3x the raid average. Focus on dodging Shadow Crash and Void Eruption.' },
            { type: 'warning', icon: '🟡', title: 'Your rotation needs work', msg: "You're casting Void Bolt after 3 GCDs instead of on cooldown. This alone is costing you ~8% DPS." },
            { type: 'success', icon: '🟢', title: 'Great movement efficiency', msg: 'Your uptime during movement phases is 94% — top 15% for your spec. Keep it up.' },
            { type: 'info', icon: '🔵', title: 'Upgrade priority: Trinket slot', msg: "Your Void-Touched Orb (ilvl 616) should be replaced with Sunwell Resonance from Xal'atath. Expected DPS gain: +4.2%." },
          ].map((msg, i) => {
            const colors = {
              danger: { bg: 'rgba(255,59,92,0.06)', border: 'rgba(255,59,92,0.2)', title: '#ff3b5c' },
              warning: { bg: 'rgba(255,159,28,0.06)', border: 'rgba(255,159,28,0.2)', title: '#ff9f1c' },
              success: { bg: 'rgba(0,255,136,0.06)', border: 'rgba(0,255,136,0.2)', title: '#00ff88' },
              info: { bg: 'rgba(0,150,255,0.06)', border: 'rgba(0,150,255,0.2)', title: '#0096ff' },
            }[msg.type];
            return (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-2xl border animate-fade-in"
                style={{ background: colors.bg, borderColor: colors.border, animationDelay: `${i * 0.15}s` }}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{msg.icon}</span>
                <div>
                  <p className="font-semibold mb-1" style={{ color: colors.title }}>{msg.title}</p>
                  <p className="text-sm text-void-secondary leading-relaxed">{msg.msg}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-4 py-20 text-center">
        <div className="max-w-lg mx-auto p-10 bg-gradient-to-br from-void-surface to-void-mid border border-void-bright/20 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-void-bright to-transparent" />
          <h2 className="font-cinzel text-2xl font-bold text-white mb-3">Ready to Git Gud?</h2>
          <p className="text-void-secondary mb-6">
            Midnight Season 1 starts March 17. Be ready from day one.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-void-glow to-void-bright text-white font-cinzel font-bold tracking-widest uppercase rounded-xl hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(123,47,242,0.35)] transition-all"
          >
            Analyze My Character <span>→</span>
          </Link>
          <p className="mt-4 text-xs text-void-muted">
            Launching with <span className="text-sunwell-gold font-semibold">Midnight Season 1 — March 17, 2026</span>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-xs text-void-muted border-t border-void-bright/10">
        StillNoob is not affiliated with Blizzard Entertainment. World of Warcraft™ is a trademark of Blizzard Entertainment, Inc.
      </footer>
    </div>
  );
}
