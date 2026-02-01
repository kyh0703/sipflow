'use client'

import { type ReactFlowState, useStore } from '@xyflow/react'
import { useEffect, useRef } from 'react'

const storeSelector = (state: ReactFlowState) => ({
  width: state.width,
  height: state.height,
  transform: state.transform,
})

type HelperLinesProps = {
  horizontal?: number
  vertical?: number
}

export function HelperLines({
  horizontal,
  vertical,
}: Readonly<HelperLinesProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width, height, transform } = useStore(storeSelector)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!ctx || !canvas) {
      return
    }

    const dpi = window.devicePixelRatio
    canvas.width = width * dpi
    canvas.height = height * dpi

    ctx.scale(dpi, dpi)
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = '#66BB6A'

    if (typeof vertical === 'number') {
      ctx.moveTo(vertical * transform[2] + transform[0], 0)
      ctx.lineTo(vertical * transform[2] + transform[0], height)
      ctx.stroke()
    }

    if (typeof horizontal === 'number') {
      ctx.moveTo(0, horizontal * transform[2] + transform[1])
      ctx.lineTo(width, horizontal * transform[2] + transform[1])
      ctx.stroke()
    }
  }, [width, height, transform, horizontal, vertical])

  return (
    <canvas
      ref={canvasRef}
      className="react-flow__canvas pointer-events-none absolute z-10 h-full w-full"
    />
  )
}
