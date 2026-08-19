'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ClipboardList, Home, MapPin, ScanLine, Truck, UserRound, X, Zap } from 'lucide-react'
import type { UserProfile } from '../services/authApi'

interface BarcodeDetectorResult {
  rawValue?: string
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
}

interface BarcodeDetectorWindow extends Window {
  BarcodeDetector?: BarcodeDetectorConstructor
}

type Step = 'pickup' | 'scan' | 'verify' | 'inventory' | 'success' | 'arrived'
type Inventory = { batchTokenId: string; category: string; quantity: number; status: string; remarks: string }

const initialInventory: Inventory = { batchTokenId: 'BATCH-TRK-001-DEMO', category: 'Family Food Packs', quantity: 850, status: 'Ready for pickup', remarks: '' }

function parseQr(value: string, current: Inventory) {
  const trimmed = value.trim()
  try {
    const data = JSON.parse(trimmed) as Partial<Inventory>
    return { ...current, ...data, quantity: Number(data.quantity ?? current.quantity), status: 'Scanned • In transit' }
  } catch {
    return { ...current, batchTokenId: trimmed || current.batchTokenId, status: 'Scanned • In transit' }
  }
}

interface TruckerLocationPageProps {
  profile?: UserProfile | null
  onSignOut?: () => void
}

export function TruckerLocationPage({ profile, onSignOut }: TruckerLocationPageProps) {
  const [step, setStep] = useState<Step>('pickup')
  const [inventory, setInventory] = useState(initialInventory)
  const [manualQr, setManualQr] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMessage, setCameraMessage] = useState('Point your camera at the QR code')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const cameraOpenRef = useRef(false)

  useEffect(() => () => {
    cameraOpenRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const updateInventory = (value: string) => {
    if (!value.trim()) return
    setInventory((current) => parseQr(value, current))
    cameraOpenRef.current = false
    setCameraOpen(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    setStep('verify')
  }

  const startCamera = async () => {
    cameraOpenRef.current = true
    setCameraOpen(true)
    setCameraMessage('Requesting camera access…')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera unavailable here. Use the manual QR fallback below.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      const Detector = (window as BarcodeDetectorWindow).BarcodeDetector
      if (!Detector) {
        setCameraMessage('Live camera preview is ready. If scanning is unavailable, use manual QR text below.')
        return
      }
      detectorRef.current = new Detector({ formats: ['qr_code'] })
      const scan = async () => {
        if (!videoRef.current || !cameraOpenRef.current || !detectorRef.current) return
        try {
          const codes = await detectorRef.current.detect(videoRef.current)
          if (codes[0]?.rawValue) updateInventory(codes[0].rawValue)
        } catch { setCameraMessage('Keep the QR code centered in the frame.') }
        if (cameraOpenRef.current) requestAnimationFrame(scan)
      }
      const video = videoRef.current
      if (video) video.onloadeddata = () => requestAnimationFrame(scan)
    } catch {
      setCameraMessage('Camera permission was denied. Use the manual QR fallback below.')
    }
  }

  const closeCamera = () => {
    cameraOpenRef.current = false
    setCameraOpen(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }

  const nav = (next: Step) => setStep(next)
  const isFlow = step !== 'pickup'

  return (
    <main className="min-h-screen bg-[#e7e6ea] p-0 text-[#15132d] sm:p-5">
      <section className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col overflow-hidden bg-white shadow-xl sm:min-h-[780px] sm:rounded-[28px]">
        <header className="flex items-center justify-between bg-[#2500ba] px-5 py-4 text-white">
          <div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full border border-white/70" /><div><p className="text-[11px] font-semibold">Trucker View</p><p className="text-[10px] text-white/70">{profile?.truckId || 'TRK-001'} • {profile?.fullName || 'Oton Warehouse'}</p></div></div>
          {onSignOut ? <button type="button" onClick={onSignOut} className="rounded border-2 border-white bg-red-500 px-2 py-1 text-[10px] font-bold">Sign out</button> : <div className="flex h-8 w-8 items-center justify-center rounded border-2 border-white bg-red-500"><Truck size={18} /></div>}
        </header>

        <div className="relative flex-1 overflow-hidden bg-[#f5f5f5]">
          <div className="absolute inset-0 opacity-55" style={{ backgroundImage: 'linear-gradient(35deg, transparent 45%, #d8d9df 46%, #d8d9df 50%, transparent 51%), linear-gradient(120deg, transparent 42%, #dfe0e5 43%, #dfe0e5 45%, transparent 46%)', backgroundSize: '90px 90px, 130px 130px' }} />
          <div className="absolute left-4 right-4 top-4 rounded-xl bg-white/95 p-3 shadow-sm"><div className="flex gap-2 text-[10px]"><MapPin className="text-[#2500ba]" size={12} /><div><p className="text-gray-400">Destination</p><p className="font-bold">Leon LGU Office</p></div></div></div>
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2500ba]/20"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2500ba] text-white"><MapPin size={17} /></div></div></div>
          <div className="absolute bottom-3 left-4 right-4 rounded-xl bg-white p-3 shadow-sm"><div className="mb-2 flex justify-between text-[9px] text-gray-400"><span>Delivery on progress</span><span className="font-bold text-[#2500ba]">LIVE</span></div><button onClick={() => nav('scan')} className="w-full rounded-full border border-[#2500ba] py-2 text-[10px] font-bold text-[#2500ba]">Pick up and Scan Now</button></div>

          {isFlow && <div className="absolute inset-0 bg-black/65" />}
          {step === 'scan' && <ScanModal onClose={() => nav('pickup')} onStart={startCamera} manualQr={manualQr} setManualQr={setManualQr} onManual={() => updateInventory(manualQr)} cameraOpen={cameraOpen} closeCamera={closeCamera} videoRef={videoRef} message={cameraMessage} />}
          {step === 'verify' && <Modal title="Verify Goods" icon={<ClipboardList />} onClose={() => nav('pickup')}><p className="text-center text-[10px] text-[#2500ba]">Batch ID: {inventory.batchTokenId}</p><p className="text-center text-[10px] text-gray-500">{inventory.quantity} {inventory.category}</p><div className="mt-4 space-y-2"><div className="rounded-lg bg-[#eceafa] p-3 text-[10px]">Sealed and untampered <Check size={13} className="float-right text-[#2500ba]" /></div><div className="rounded-lg bg-[#eceafa] p-3 text-[10px]">No visible damage <Check size={13} className="float-right text-[#2500ba]" /></div></div><button onClick={() => nav('inventory')} className="mt-4 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white">Verify and Update goods</button></Modal>}
          {step === 'inventory' && <Modal title="Update Inventory" onClose={() => nav('verify')}><label className="text-[10px] font-semibold">Item name</label><input value={inventory.category} onChange={(e) => setInventory({ ...inventory, category: e.target.value })} className="mt-1 w-full rounded-lg border p-3 text-xs" /><label className="mt-3 block text-[10px] font-semibold">Amount</label><input type="number" value={inventory.quantity} onChange={(e) => setInventory({ ...inventory, quantity: Number(e.target.value) })} className="mt-1 w-full rounded-lg border p-3 text-xs" /><label className="mt-3 block text-[10px] font-semibold">Remarks</label><textarea value={inventory.remarks} onChange={(e) => setInventory({ ...inventory, remarks: e.target.value })} placeholder="Describe the current status of goods" className="mt-1 h-20 w-full resize-none rounded-lg border p-3 text-xs" /><button onClick={() => { setInventory({ ...inventory, status: 'In transit' }); nav('success') }} className="mt-4 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white">Done</button></Modal>}
          {step === 'success' && <Modal title="Verification Successful!" icon={<ClipboardList />} onClose={() => nav('pickup')}><p className="text-center text-[10px] text-gray-500">Inventory updated instantly<br />Status: <b className="text-[#2500ba]">{inventory.status}</b></p><button onClick={() => nav('arrived')} className="mt-5 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white">Done</button></Modal>}
          {step === 'arrived' && <Modal title="Successful" icon={<ClipboardList />} onClose={() => nav('pickup')}><p className="text-center text-[10px] text-gray-500">Shipment is now in transit.<br />{inventory.quantity} {inventory.category}</p><button onClick={() => nav('pickup')} className="mt-5 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white">Done</button></Modal>}
        </div>
        <nav className="flex h-14 items-center justify-around border-t bg-white text-[#2500ba]"><button onClick={() => nav('pickup')} aria-label="Home"><Home size={21} /></button><button onClick={() => nav('scan')} aria-label="Scan" className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#2500ba] text-white shadow-lg"><ScanLine size={26} /></button><button aria-label="Profile"><UserRound size={21} /></button></nav>
      </section>
    </main>
  )
}

function Modal({ title, icon, children, onClose }: { title: string; icon?: React.ReactNode; children: React.ReactNode; onClose: () => void }) { return <div className="absolute left-5 right-5 top-1/2 z-10 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl"><button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-[#2500ba]"><X size={16} /></button>{icon && <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#dedafb] text-[#2500ba]">{icon}</div>}<h2 className="text-center text-xs font-bold text-[#2500ba]">{title}</h2>{children}</div> }

function ScanModal({ onClose, onStart, manualQr, setManualQr, onManual, cameraOpen, closeCamera, videoRef, message }: { onClose: () => void; onStart: () => void; manualQr: string; setManualQr: (value: string) => void; onManual: () => void; cameraOpen: boolean; closeCamera: () => void; videoRef: React.RefObject<HTMLVideoElement | null>; message: string }) { return <div className="absolute inset-0 z-10 flex flex-col bg-[#15131f]/90 p-5 text-white"><div className="flex items-center justify-between"><button onClick={onClose} aria-label="Back"><ChevronLeft /></button><p className="text-xs font-bold">Scan QR code</p><Zap size={16} /></div><div className="relative mx-auto mt-16 aspect-square w-full max-w-[270px] overflow-hidden rounded-2xl border-4 border-[#2500ba] bg-black"><video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraOpen ? 'opacity-100' : 'opacity-25'}`} />{!cameraOpen && <div className="absolute inset-0 flex items-center justify-center"><ScanLine size={100} className="text-white" /></div>}<div className="absolute left-5 right-5 top-1/2 h-0.5 bg-[#2500ba]" /></div><p className="mt-4 text-center text-[11px] text-white/75">{message}</p><button onClick={cameraOpen ? closeCamera : onStart} className="mx-auto mt-4 rounded-full bg-white px-6 py-3 text-[10px] font-bold text-[#2500ba]">{cameraOpen ? 'Close camera' : 'Pick up and scan now'}</button><div className="mx-auto mt-auto w-full max-w-[310px] rounded-xl bg-white p-3 text-[#15132d]"><p className="mb-2 text-[10px] font-bold text-[#2500ba]">Manual QR fallback</p><input value={manualQr} onChange={(e) => setManualQr(e.target.value)} placeholder="Paste token ID or JSON payload" className="w-full rounded-lg border p-3 text-[10px]" /><button onClick={onManual} className="mt-2 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white">Use scanned value</button></div></div> }

export type { Inventory }
export { initialInventory }
