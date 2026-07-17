import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from 'recharts';

interface ForecastData {
  historical: { date: string; value: number }[];
  nextMonthForecast: number;
}

interface MLResponse {
  status: string;
  data: {
    sales: ForecastData;
    inventory: ForecastData;
    liabilities: ForecastData;
    assets: ForecastData;
  };
}

export default function MLAnalytics() {
  const [data, setData] = useState<MLResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/analytics/ml-forecast');
        
        // Handle custom error payload (HTTP 200 but status="error")
        if (response.data?.status === 'error') {
            console.error("Backend returned error payload:", response.data);
            // We can still set the fallback data so it plots zeros
            setData(response.data.data);
            setErrorMsg(response.data.message || "Failed to generate AI Forecasts.");
        } else {
            setData(response.data.data);
        }
      } catch (error: any) {
        console.error('Error fetching ML data:', error);
        setErrorMsg(error?.response?.data?.error || error.message || "Failed to load AI Forecasts.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading AI Forecasts...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-red-600 font-bold mb-2">Error</h2>
        <p className="text-gray-700">{errorMsg || "Failed to load AI Forecasts."}</p>
      </div>
    );
  }

  // Prepare chart data by combining historical and forecast
  const prepChartData = (forecastData: ForecastData, name: string) => {
    if (!forecastData || !forecastData.historical) return [];
    
    const chartData: any[] = forecastData.historical.map(item => ({
      date: item.date,
      [name]: item.value,
      isForecast: false
    }));

    // Add forecast point
    if (chartData.length > 0) {
       const lastPoint = chartData[chartData.length - 1];
       // Connect the dotted line to the solid line by sharing the last historical point
       lastPoint[`Predicted ${name}`] = lastPoint[name];
       
       const lastDateStr = lastPoint.date;
       const lastDate = new Date(lastDateStr + '-01');
       lastDate.setMonth(lastDate.getMonth() + 1);
       const nextMonthStr = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
       
       chartData.push({
         date: nextMonthStr,
         [`Predicted ${name}`]: forecastData.nextMonthForecast,
         isForecast: true
       });
    }

    return chartData;
  };

  const salesData = prepChartData(data.sales, 'Sales');
  const inventoryData = prepChartData(data.inventory, 'Inventory');
  const assetLiabData = prepChartData(data.assets, 'Assets').map((item, index) => {
    const liabItem = prepChartData(data.liabilities, 'Liabilities')[index];
    return {
      ...item,
      Liabilities: liabItem?.Liabilities || 0,
      'Predicted Liabilities': liabItem?.['Predicted Liabilities'] || 0
    };
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">XGBoost Predictive Analytics</h1>
      
      {errorMsg && (
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
          <p className="font-semibold">Notice:</p>
          <p>{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sales Forecast */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Sales Forecast</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
                <Line type="monotone" dataKey="Predicted Sales" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Needs */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Inventory Depletion Prediction</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Inventory" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Predicted Inventory" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assets vs Liabilities */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Assets & Liabilities Projection</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={assetLiabData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="Assets" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Area type="monotone" dataKey="Predicted Assets" stackId="1" stroke="#34d399" strokeDasharray="5 5" fill="#34d399" fillOpacity={0.1} />
                <Area type="monotone" dataKey="Liabilities" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                <Area type="monotone" dataKey="Predicted Liabilities" stackId="2" stroke="#f87171" strokeDasharray="5 5" fill="#f87171" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
