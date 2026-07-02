import { useState, useEffect } from 'react'
import { Terminal, ShoppingCart, Zap, Shield, Cpu, Globe, Database, CheckCircle, XCircle, FileDown } from 'lucide-react'
import { io } from 'socket.io-client'
import { jsPDF } from "jspdf"

// Initialize socket connection outside the component
const socket = io('http://localhost:3000')

export default function App() {
  const [chaosMode, setChaosMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // State for the Infrastructure Stepper & Receipt
  const [activeStep, setActiveStep] = useState(0) // 0: Idle, 1: Gateway, 2: Redis, 3: Bank, 4: Ledger
  const [stepStatus, setStepStatus] = useState('idle') // 'idle', 'loading', 'success', 'error'
  const [finalReceipt, setFinalReceipt] = useState(null)

  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), message: 'System initialized.', type: 'info' }
  ])

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      message,
      type
    }])
  }

  // Listen for the background WebSocket event
  useEffect(() => {
    socket.on('payment_cleared', (data) => {
      addLog(`[ASYNC EVENT] Bank confirmed payment for Key ${data.idempotencyKey.split('-')[0]}!`, 'success')
      setIsProcessing(false)
      setActiveStep(4)
      setStepStatus('success')
      setFinalReceipt(data) // Save the data for the PDF
    })

    return () => socket.off('payment_cleared')
  }, [])

  const downloadReceipt = () => {
    if (!finalReceipt) return;

    const doc = new jsPDF();
    const shortKey = finalReceipt.idempotencyKey.split('-')[0].toUpperCase();
    const date = new Date().toLocaleString();

    // Draw the PDF
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.text("Official Transaction Receipt", 20, 30);
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Date & Time: ${date}`, 20, 50);
    doc.text(`Status: COMPLETED (MongoDB Ledger Verified)`, 20, 60);
    doc.text(`Idempotency Key: ${finalReceipt.idempotencyKey}`, 20, 70);
    doc.text(`Processor Transaction ID: ${finalReceipt.receipt.transactionId}`, 20, 80);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Amount Paid: $299.00 USD`, 20, 100);

    doc.save(`Receipt_${shortKey}.pdf`);
  };

  const fireRequest = async (idempotencyKey, reqNumber = 1) => {
    try {
      addLog(`[Req ${reqNumber}] Firing request with Key: ${idempotencyKey.split('-')[0]}...`, 'info')
      
      const response = await fetch('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey
        },
        body: JSON.stringify({ amount: 299, currency: "USD" })
      })

      const data = await response.json()

      // UI strictly follows Request 1 so the visual stepper doesn't flicker during Chaos Mode
      if (reqNumber === 1) {
        if (response.status === 202) {
          addLog(`[Req ${reqNumber}] 202 ACCEPTED: ${data.message}`, 'warning')
          setActiveStep(3)
        } else if (response.status === 409) {
          addLog(`[Req ${reqNumber}] 409 CONFLICT: ${data.error}`, 'error')
          setActiveStep(2)
          setStepStatus('error')
          setIsProcessing(false)
        } else if (response.status === 429) {
          addLog(`[Req ${reqNumber}] 429 ERROR: Bot behavior detected.`, 'error')
          setActiveStep(1)
          setStepStatus('error')
          setIsProcessing(false)
        }
      } else {
        if (response.status === 409) addLog(`[Req ${reqNumber}] 409 CONFLICT: Blocked by Redis Lock.`, 'error')
        if (response.status === 429) addLog(`[Req ${reqNumber}] 429 ERROR: Blocked by Gateway.`, 'error')
      }

    } catch (error) {
      addLog(`[Req ${reqNumber}] NETWORK ERROR! Is the backend running?`, 'error')
      setStepStatus('error')
      setIsProcessing(false)
    }
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    setActiveStep(1)
    setStepStatus('loading')
    setFinalReceipt(null) // Clear old receipt
    
    const idempotencyKey = crypto.randomUUID()

    if (chaosMode) {
      addLog('⚡ CHAOS MODE: Firing 3 simultaneous requests...', 'warning')
      await Promise.all([
        fireRequest(idempotencyKey, 1),
        fireRequest(idempotencyKey, 2),
        fireRequest(idempotencyKey, 3)
      ])
    } else {
      setTimeout(() => setActiveStep(2), 150) 
      await fireRequest(idempotencyKey, 1)
    }
  }

  const StepItem = ({ num, title, desc, icon: Icon }) => {
    const isActive = activeStep === num
    const isPast = activeStep > num && stepStatus !== 'error'
    const isError = activeStep === num && stepStatus === 'error'
    
    let colorClass = "text-gray-400 border-gray-200"
    if (isActive && stepStatus === 'loading') colorClass = "text-blue-500 border-blue-500 animate-pulse"
    if (isActive && stepStatus === 'success') colorClass = "text-green-500 border-green-500"
    if (isError) colorClass = "text-red-500 border-red-500"
    if (isPast) colorClass = "text-green-500 border-green-500"

    return (
      <div className={`flex items-start gap-4 p-3 rounded-lg border transition-all ${colorClass} ${isActive ? 'bg-slate-50' : 'bg-transparent'}`}>
        <div className="mt-1">{isError ? <XCircle size={20} /> : isPast ? <CheckCircle size={20} /> : <Icon size={20} />}</div>
        <div>
          <h4 className="font-bold text-sm text-gray-800">{title}</h4>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row font-sans">
      
      {/* COLUMN 1: The Storefront */}
      <div className="w-full lg:w-1/3 p-6 flex flex-col items-center pt-12 relative">
        
        {/* Chaos Mode Toggle (Moved to sit neatly above the card) */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm mb-6 w-full max-w-sm justify-between">
          <div className="flex items-center gap-2">
            <Zap className={chaosMode ? "text-yellow-500" : "text-gray-400"} size={20} />
            <span className="font-semibold text-gray-700 text-sm">Chaos Mode</span>
          </div>
          <button 
            onClick={() => setChaosMode(!chaosMode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${chaosMode ? 'bg-red-500' : 'bg-gray-300'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${chaosMode ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Product Card */}
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
          <div className="h-40 bg-gray-50 rounded-xl mb-6 flex items-center justify-center border border-gray-100">
            <ShoppingCart size={48} className="text-gray-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Premium Wireless Headphones</h2>
          
          <div className="flex justify-between items-center mb-6 mt-4">
            <span className="text-3xl font-extrabold text-gray-900">$299</span>
          </div>

          <button 
            onClick={handlePayment}
            disabled={isProcessing}
            className={`w-full py-4 rounded-xl text-white font-bold transition-all
              ${isProcessing ? 'bg-indigo-500 cursor-not-allowed animate-pulse' : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-95'}
            `}
          >
            {isProcessing ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </div>

      {/* COLUMN 2: System Observability */}
      <div className="w-full lg:w-1/3 p-6 flex flex-col items-center pt-12 bg-gray-50/50 border-x border-gray-200">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-lg border border-gray-100 h-full max-h-[600px]">
          <h3 className="text-sm font-bold text-gray-400 mb-6 uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} /> System Observability
          </h3>
          <div className="space-y-4">
            <StepItem num={1} title="API Gateway" desc="Token Bucket Rate Limiting" icon={Shield} />
            <StepItem num={2} title="Redis Engine" desc="Idempotency Atomic Lock" icon={Cpu} />
            <StepItem num={3} title="Bank Network" desc="Async Webhook/Socket Wait" icon={Globe} />
            <StepItem num={4} title="MongoDB Ledger" desc="Permanent Audit Record Saved" icon={Database} />
          </div>

          {/* Download Receipt Button (Fades in on success) */}
          <div className={`mt-8 transition-opacity duration-500 ${activeStep === 4 && stepStatus === 'success' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button 
              onClick={downloadReceipt}
              className="w-full py-3 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold border border-blue-200 transition-all flex items-center justify-center gap-2"
            >
              <FileDown size={18} />
              Download Receipt (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 3: Developer Console */}
      <div className="w-full lg:w-1/3 bg-gray-900 flex flex-col lg:h-screen overflow-hidden">
        <div className="bg-gray-950 p-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
          <Terminal className="text-green-400" size={20} />
          <h3 className="text-gray-200 font-mono font-semibold text-sm tracking-wide">DISTRIBUTED SYSTEM LOGS</h3>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto font-mono text-sm space-y-3 min-h-[400px]">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-4">
              <span className="text-gray-500 shrink-0">[{log.time}]</span>
              <span className={`
                ${log.type === 'info' ? 'text-blue-400' : ''}
                ${log.type === 'success' ? 'text-green-400 font-bold' : ''}
                ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                ${log.type === 'warning' ? 'text-yellow-400 font-semibold' : ''}
              `}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}