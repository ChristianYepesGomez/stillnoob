export default function StatCard({ label, value, subValue, color = 'text-white' }) {
  return (
    <div className="text-center p-3 rounded-xl bg-void-mid/30 border border-void-bright/10">
      <p className={`text-2xl font-bold m-0 ${color}`}>
        {value}
        {subValue && <span className="text-xs font-normal text-void-text ml-1">{subValue}</span>}
      </p>
      <p className="text-[10px] text-void-text m-0 mt-1">{label}</p>
    </div>
  );
}
