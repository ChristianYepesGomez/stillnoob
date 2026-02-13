import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { guildsAPI } from '../services/api';
import RealmSelect from '../components/RealmSelect';

export default function GuildPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { guildId } = useParams();
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', realm: '', realmSlug: '', region: 'eu' });
  const [joinForm, setJoinForm] = useState({ guildId: '', inviteCode: '' });
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    guildsAPI.list()
      .then(r => {
        setGuilds(r.data);
        if (guildId) {
          loadGuild(parseInt(guildId));
        }
      })
      .finally(() => setLoading(false));
  }, [guildId]);

  const loadGuild = async (id) => {
    try {
      const { data } = await guildsAPI.get(id);
      setSelectedGuild(data);
    } catch {
      setSelectedGuild(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const realmSlug = form.realmSlug || form.realm.toLowerCase().replace(/\s+/g, '-');
      const { data } = await guildsAPI.create({ ...form, realmSlug });
      setGuilds(prev => [...prev, data.guild]);
      setForm({ name: '', realm: '', realmSlug: '', region: 'eu' });
      navigate(`/guild/${data.guild.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create guild');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setJoining(true);
    try {
      const id = parseInt(joinForm.guildId);
      if (isNaN(id)) throw new Error('Invalid guild ID');
      await guildsAPI.join(id, joinForm.inviteCode);
      setJoinForm({ guildId: '', inviteCode: '' });
      const { data } = await guildsAPI.list();
      setGuilds(data);
      navigate(`/guild/${id}`);
      loadGuild(id);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to join guild');
    } finally {
      setJoining(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!selectedGuild) return;
    try {
      const { data } = await guildsAPI.regenerateInviteCode(selectedGuild.id);
      setSelectedGuild(prev => ({ ...prev, inviteCode: data.inviteCode }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate invite code');
    }
  };

  const handleLeave = async (id) => {
    try {
      await guildsAPI.leave(id);
      setGuilds(prev => prev.filter(g => g.id !== id));
      if (selectedGuild?.id === id) setSelectedGuild(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave guild');
    }
  };

  const handleKick = async (userId) => {
    if (!selectedGuild) return;
    try {
      await guildsAPI.kickMember(selectedGuild.id, userId);
      await loadGuild(selectedGuild.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to kick member');
    }
  };

  const handleRoleChange = async (userId, role) => {
    if (!selectedGuild) return;
    try {
      await guildsAPI.updateMemberRole(selectedGuild.id, userId, role);
      await loadGuild(selectedGuild.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-void-bright border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Guild detail view
  if (selectedGuild) {
    const myMembership = selectedGuild.members?.find(m => m.userId === user?.id);
    const isLeader = myMembership?.role === 'leader';
    const isOfficer = isLeader || myMembership?.role === 'officer';

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => { setSelectedGuild(null); navigate('/guild'); }} className="text-xs text-void-secondary hover:text-void-accent mb-2">
              <i className="fas fa-arrow-left mr-1" /> Back to guilds
            </button>
            <h1 className="font-cinzel text-2xl font-bold text-white">{selectedGuild.name}</h1>
            <p className="text-sm text-void-secondary">{selectedGuild.realm} — {selectedGuild.region.toUpperCase()}</p>
          </div>
          {!isLeader && (
            <button
              onClick={() => handleLeave(selectedGuild.id)}
              className="px-4 py-2 bg-blood-red/20 text-blood-red border border-blood-red/30 rounded-lg text-sm hover:bg-blood-red/30 transition-colors"
            >
              Leave Guild
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        {/* Invite Code (leader/officer only) */}
        {isOfficer && selectedGuild.inviteCode && (
          <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5">
            <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-3">
              <i className="fas fa-key mr-2 text-sunwell-gold" />
              Invite Code
            </h2>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-2 bg-void-deep rounded-lg text-sunwell-gold font-orbitron text-lg tracking-widest border border-void-bright/10">
                {selectedGuild.inviteCode}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(selectedGuild.inviteCode)}
                className="px-3 py-2 bg-void-surface text-void-accent rounded-lg text-sm hover:bg-void-bright/20 transition-colors"
                title="Copy"
              >
                <i className="fas fa-copy" />
              </button>
              <button
                onClick={handleRegenerateCode}
                className="px-3 py-2 bg-void-surface text-sunwell-amber rounded-lg text-sm hover:bg-sunwell-amber/20 transition-colors"
                title="Regenerate code"
              >
                <i className="fas fa-sync-alt" />
              </button>
            </div>
            <p className="text-xs text-void-muted mt-2">Share this code with players you want to invite. Guild ID: {selectedGuild.id}</p>
          </div>
        )}

        {/* Members */}
        <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-users mr-2 text-void-accent" />
            Members ({selectedGuild.members?.length || 0})
          </h2>
          <div className="space-y-2">
            {(selectedGuild.members || []).map(member => (
              <div key={member.userId} className="flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 border border-void-bright/5">
                <span className="text-sm text-white font-medium flex-1">
                  {member.displayName || member.userId}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                  member.role === 'leader' ? 'bg-sunwell-gold/20 text-sunwell-gold' :
                  member.role === 'officer' ? 'bg-void-bright/20 text-void-bright' :
                  'bg-void-surface text-void-secondary'
                }`}>
                  {member.role}
                </span>
                {isOfficer && member.userId !== user?.id && member.role !== 'leader' && (
                  <div className="flex gap-1">
                    {isLeader && member.role !== 'officer' && (
                      <button
                        onClick={() => handleRoleChange(member.userId, 'officer')}
                        className="text-[10px] px-2 py-0.5 rounded bg-void-surface text-void-accent hover:bg-void-bright/20"
                        title="Promote to Officer"
                      >
                        <i className="fas fa-arrow-up" />
                      </button>
                    )}
                    {isLeader && member.role === 'officer' && (
                      <button
                        onClick={() => handleRoleChange(member.userId, 'member')}
                        className="text-[10px] px-2 py-0.5 rounded bg-void-surface text-sunwell-amber hover:bg-sunwell-amber/20"
                        title="Demote to Member"
                      >
                        <i className="fas fa-arrow-down" />
                      </button>
                    )}
                    <button
                      onClick={() => handleKick(member.userId)}
                      className="text-[10px] px-2 py-0.5 rounded bg-blood-red/10 text-blood-red hover:bg-blood-red/20"
                      title="Kick"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Guild list view
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-cinzel text-2xl font-bold text-white">Guilds</h1>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My guilds */}
        <div className="bg-void-mid/50 rounded-2xl border border-void-bright/15 p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-shield-alt mr-2 text-void-accent" />
            My Guilds
          </h2>
          {guilds.length === 0 ? (
            <p className="text-sm text-void-secondary">You haven't joined any guilds yet.</p>
          ) : (
            <div className="space-y-2">
              {guilds.map(g => (
                <button
                  key={g.id}
                  onClick={() => { navigate(`/guild/${g.id}`); loadGuild(g.id); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 hover:bg-void-surface/30 border border-void-bright/10 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-white">{g.name}</span>
                  <span className="text-xs text-void-secondary">{g.realm}</span>
                  <span className="text-[10px] text-void-muted ml-auto uppercase">{g.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create guild */}
        <div className="bg-void-mid/50 rounded-2xl border border-void-bright/15 p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-plus mr-2 text-void-accent" />
            Create Guild
          </h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Guild name"
              className="w-full px-3 py-2 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white placeholder-void-muted focus:border-void-bright focus:outline-none"
              required
            />
            <select
              value={form.region}
              onChange={(e) => setForm(p => ({ ...p, region: e.target.value, realm: '', realmSlug: '' }))}
              className="w-full px-3 py-2 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white focus:outline-none"
            >
              <option value="eu">EU</option>
              <option value="us">US</option>
              <option value="kr">KR</option>
              <option value="tw">TW</option>
            </select>
            <RealmSelect
              region={form.region}
              value={form.realm}
              onChange={(name, slug) => setForm(p => ({ ...p, realm: name, realmSlug: slug }))}
              inputClassName="w-full px-3 py-2 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white placeholder-void-muted focus:border-void-bright focus:outline-none"
              placeholder="Realm (e.g. Tarren Mill)"
            />
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2 bg-void-bright hover:bg-void-glow text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Guild'}
            </button>
          </form>
        </div>

        {/* Join guild */}
        <div className="bg-void-mid/50 rounded-2xl border border-void-bright/15 p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-sign-in-alt mr-2 text-void-accent" />
            Join Guild
          </h2>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              value={joinForm.guildId}
              onChange={(e) => setJoinForm(p => ({ ...p, guildId: e.target.value }))}
              placeholder="Guild ID"
              className="w-full px-3 py-2 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white placeholder-void-muted focus:border-void-bright focus:outline-none"
              required
            />
            <input
              type="text"
              value={joinForm.inviteCode}
              onChange={(e) => setJoinForm(p => ({ ...p, inviteCode: e.target.value }))}
              placeholder="Invite code"
              className="w-full px-3 py-2 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white placeholder-void-muted focus:border-void-bright focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={joining}
              className="w-full py-2 bg-void-bright hover:bg-void-glow text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join Guild'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
