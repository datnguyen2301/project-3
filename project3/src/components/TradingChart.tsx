"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import { TrendingUp, Maximize2, Settings, X, CandlestickChart, LineChart, BarChart2 } from "lucide-react";
import { getKlines, type Kline } from "@/services/binanceApi";

type ChartType = "candlestick" | "line" | "area";
type Indicator = "MA7" | "MA25" | "MA99" | "EMA" | "VOL";

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  
  const [timeframe, setTimeframe] = useState("1h");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [showSettings, setShowSettings] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Indicator[]>(["VOL"]);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [showPriceLine, setShowPriceLine] = useState(true);
  const [chartData, setChartData] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
  }>({ open: 0, high: 0, low: 0, close: 0 });

  const calculateMA = (data: number[], period: number) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  };

  const calculateEMA = (data: number[], period: number) => {
    const k = 2 / (period + 1);
    const emaData = [data[0]];
    for (let i = 1; i < data.length; i++) {
      emaData.push(data[i] * k + emaData[i - 1] * (1 - k));
    }
    return emaData;
  };

  const toggleIndicator = (indicator: Indicator) => {
    if (activeIndicators.includes(indicator)) {
      setActiveIndicators(activeIndicators.filter(i => i !== indicator));
    } else {
      setActiveIndicators([...activeIndicators, indicator]);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Resize chart when fullscreen changes
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      }, 100);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let isDisposed = false;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#181a20" },
        textColor: "#848e9c",
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: "#2b3139" },
        horzLines: { color: "#2b3139" },
      },
      timeScale: {
        borderColor: "#2b3139",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#2b3139",
      },
      crosshair: {
        mode: 1,
      },
    });

    chartRef.current = chart;

    let mainSeries;
    if (chartType === "candlestick") {
      mainSeries = chart.addCandlestickSeries({
        upColor: "#0ecb81",
        downColor: "#f6465d",
        borderVisible: false,
        wickUpColor: "#0ecb81",
        wickDownColor: "#f6465d",
      });
    } else if (chartType === "line") {
      mainSeries = chart.addLineSeries({
        color: "#2962FF",
        lineWidth: 2,
      });
    } else {
      mainSeries = chart.addAreaSeries({
        topColor: "rgba(41, 98, 255, 0.4)",
        bottomColor: "rgba(41, 98, 255, 0.0)",
        lineColor: "#2962FF",
        lineWidth: 2,
      });
    }

    mainSeriesRef.current = mainSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    volumeSeriesRef.current = volumeSeries;

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const fetchChartData = async () => {
      if (isDisposed) return;
      
      try {
        const interval = timeframe === "1H" ? "1h" : timeframe === "4H" ? "4h" : timeframe === "1D" ? "1d" : timeframe === "1W" ? "1w" : timeframe === "1M" ? "1M" : timeframe;
        const klines: Kline[] = await getKlines("BTCUSDT", interval, 200);
        
        if (isDisposed) return;
        
        const candleData = klines.map((k) => ({
          time: (k.openTime / 1000) as any,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
        }));

        const volumeData = klines.map((k) => ({
          time: (k.openTime / 1000) as any,
          value: parseFloat(k.volume),
          color: parseFloat(k.close) >= parseFloat(k.open) ? "#0ecb81" : "#f6465d",
        }));

        if (isDisposed) return;

        if (chartType === "candlestick") {
          mainSeries.setData(candleData);
        } else {
          const lineData = candleData.map(d => ({
            time: d.time,
            value: d.close,
          }));
          mainSeries.setData(lineData);
        }

        if (activeIndicators.includes("VOL")) {
          volumeSeries.setData(volumeData);
        } else {
          volumeSeries.setData([]);
        }

        // Clear existing indicators safely
        try {
          if (isDisposed) return;
          indicatorSeriesRef.current.forEach(series => {
            try {
              if (!isDisposed) chart.removeSeries(series);
            } catch (e) {
              // Series already removed
            }
          });
          indicatorSeriesRef.current.clear();
        } catch (e) {
          // Ignore errors
        }

        if (isDisposed) return;
        const closePrices = candleData.map(d => d.close);
        
        if (isDisposed) return;
        
        if (activeIndicators.includes("MA7")) {
          const ma7 = calculateMA(closePrices, 7);
          const ma7Data = candleData
            .map((d, i) => (ma7[i] !== null && ma7[i] !== undefined ? { time: d.time, value: ma7[i] as number } : null))
            .filter((item): item is { time: any; value: number } => item !== null);
          if (ma7Data.length > 0 && !isDisposed) {
            const ma7Series = chart.addLineSeries({
              color: "#f0b90b",
              lineWidth: 1,
            });
            ma7Series.setData(ma7Data);
            indicatorSeriesRef.current.set("MA7", ma7Series);
          }
        }

        if (activeIndicators.includes("MA25") && !isDisposed) {
          const ma25 = calculateMA(closePrices, 25);
          const ma25Data = candleData
            .map((d, i) => (ma25[i] !== null && ma25[i] !== undefined ? { time: d.time, value: ma25[i] as number } : null))
            .filter((item): item is { time: any; value: number } => item !== null);
          if (ma25Data.length > 0 && !isDisposed) {
            const ma25Series = chart.addLineSeries({
              color: "#e056fd",
              lineWidth: 1,
            });
            ma25Series.setData(ma25Data);
            indicatorSeriesRef.current.set("MA25", ma25Series);
          }
        }

        if (activeIndicators.includes("MA99") && !isDisposed) {
          const ma99 = calculateMA(closePrices, 99);
          const ma99Data = candleData
            .map((d, i) => (ma99[i] !== null && ma99[i] !== undefined ? { time: d.time, value: ma99[i] as number } : null))
            .filter((item): item is { time: any; value: number } => item !== null);
          if (ma99Data.length > 0 && !isDisposed) {
            const ma99Series = chart.addLineSeries({
              color: "#2962FF",
              lineWidth: 1,
            });
            ma99Series.setData(ma99Data);
            indicatorSeriesRef.current.set("MA99", ma99Series);
          }
        }

        if (activeIndicators.includes("EMA") && !isDisposed) {
          const ema12 = calculateEMA(closePrices, 12);
          const emaData = candleData
            .map((d, i) => (ema12[i] !== null && ema12[i] !== undefined ? { time: d.time, value: ema12[i] as number } : null))
            .filter((item): item is { time: any; value: number } => item !== null);
          if (emaData.length > 0 && !isDisposed) {
            const emaSeries = chart.addLineSeries({
              color: "#00D9FF",
              lineWidth: 1,
            });
            emaSeries.setData(emaData);
            indicatorSeriesRef.current.set("EMA", emaSeries);
          }
        }
        
        if (candleData.length !== 0 && !isDisposed) {
          const lastCandle = candleData[candleData.length - 1];
          setChartData(lastCandle);
        }

        if (!isDisposed) {
          chart.timeScale().fitContent();
        }
      } catch (error) {
        if (!isDisposed) {
          console.error('Error fetching chart data:', error);
        }
      }
    };

    fetchChartData();
    const interval = setInterval(fetchChartData, 5000);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current && !isDisposed) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener("resize", handleResize);
      clearInterval(interval);
      try {
        chart.remove();
      } catch (e) {
        // Chart already disposed
      }
    };
  }, [timeframe, chartType, activeIndicators]);

  return (
    <div className={`bg-[#181a20] rounded flex flex-col overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139] shrink-0">
        <div className="flex items-center gap-4" suppressHydrationWarning>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">O:</span>
              <span className="text-white font-medium">{chartData.open.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">H:</span>
              <span className="text-green-500 font-medium">{chartData.high.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">L:</span>
              <span className="text-red-500 font-medium">{chartData.low.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">C:</span>
              <span className="text-white font-medium">{chartData.close.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeIndicators.filter(i => i !== "VOL").map(indicator => (
              <span key={indicator} className="px-2 py-0.5 text-xs bg-[#2b3139] text-yellow-500 rounded">
                {indicator}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowIndicators(!showIndicators)} className={`p-1.5 rounded transition-colors ${showIndicators ? 'text-yellow-500 bg-[#2b3139]' : 'text-gray-400 hover:text-white hover:bg-[#2b3139]'}`}>
              <TrendingUp size={16} />
            </button>
            {showIndicators && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowIndicators(false)} />
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#1e2329] border border-[#2b3139] rounded shadow-xl z-50">
                  <div className="p-2">
                    <div className="text-xs text-gray-400 font-medium mb-2 px-2">Indicators</div>
                    {(["MA7", "MA25", "MA99", "EMA", "VOL"] as Indicator[]).map(indicator => (
                      <button key={indicator} onClick={() => toggleIndicator(indicator)} className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-[#2b3139] rounded transition-colors">
                        <span className="text-white">{indicator}</span>
                        {activeIndicators.includes(indicator) && <span className="text-yellow-500">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setChartType(chartType === "candlestick" ? "line" : chartType === "line" ? "area" : "candlestick")} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded transition-colors">
            {chartType === "candlestick" ? <CandlestickChart size={16} /> : chartType === "line" ? <LineChart size={16} /> : <BarChart2 size={16} />}
          </button>
          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded transition-colors ${showSettings ? 'text-yellow-500 bg-[#2b3139]' : 'text-gray-400 hover:text-white hover:bg-[#2b3139]'}`}>
              <Settings size={16} />
            </button>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                <div className="absolute top-full right-0 mt-2 w-56 bg-[#1e2329] border border-[#2b3139] rounded shadow-xl z-50 p-3">
                  <div className="text-sm text-white font-medium mb-3">Chart Settings</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Grid Lines</span>
                      <input 
                        type="checkbox" 
                        checked={showGridLines} 
                        onChange={(e) => {
                          setShowGridLines(e.target.checked);
                          if (chartRef.current) {
                            chartRef.current.applyOptions({
                              grid: {
                                vertLines: { visible: e.target.checked, color: "#2b3139" },
                                horzLines: { visible: e.target.checked, color: "#2b3139" },
                              },
                            });
                          }
                        }}
                        className="rounded accent-yellow-500" 
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Crosshair</span>
                      <input 
                        type="checkbox" 
                        checked={showCrosshair} 
                        onChange={(e) => {
                          setShowCrosshair(e.target.checked);
                          if (chartRef.current) {
                            chartRef.current.applyOptions({
                              crosshair: {
                                mode: e.target.checked ? 1 : 0,
                              },
                            });
                          }
                        }}
                        className="rounded accent-yellow-500" 
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Price Line</span>
                      <input 
                        type="checkbox" 
                        checked={showPriceLine} 
                        onChange={(e) => {
                          setShowPriceLine(e.target.checked);
                          if (mainSeriesRef.current) {
                            mainSeriesRef.current.applyOptions({
                              lastValueVisible: e.target.checked,
                              priceLineVisible: e.target.checked,
                            });
                          }
                        }}
                        className="rounded accent-yellow-500" 
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={toggleFullscreen} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded transition-colors">
            {isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <div ref={chartContainerRef} className="relative flex-1 min-h-0" />
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#2b3139] shrink-0">
        {["1m", "5m", "15m", "1H", "4H", "1D", "1W", "1M"].map((tf) => (
          <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-1 text-xs rounded transition-colors ${timeframe === tf ? "bg-yellow-500 text-black font-medium" : "text-gray-400 hover:text-white hover:bg-[#2b3139]"}`}>
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}
