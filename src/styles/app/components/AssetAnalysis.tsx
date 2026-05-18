import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export function AssetAnalysis() {
  const data = [
    { name: 'Food packs', value: 60, color: '#22c55e' },
    { name: 'med kit', value: 31, color: '#3b82f6' },
    { name: 'others', value: 9, color: '#ef4444' }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-6">Asset analysis</h2>

      <div className="flex flex-col items-center">
        <div className="w-64 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={100}
                paddingAngle={0}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex gap-6 mt-4">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded`} style={{ backgroundColor: item.color }}></div>
              <span className="text-sm font-semibold text-gray-700 tracking-tight">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
