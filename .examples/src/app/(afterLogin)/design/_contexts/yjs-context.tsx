import logger from '@/lib/logger'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

type YjsState = {
  yDoc: Y.Doc
  isConnected: boolean
  isSynced: boolean
  projectId: string
  flowId: string
}

const YjsContext = createContext<YjsState | undefined>(undefined)

type YjsProviderProps = {
  projectId: string
  flowId: string
  baseUrl: string
} & PropsWithChildren

export const YjsProvider = ({
  projectId,
  flowId,
  baseUrl,
  children,
}: YjsProviderProps) => {
  const yDocRef = useRef<Y.Doc>(new Y.Doc())
  const startTimeRef = useRef<number>(performance.now())

  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)

  const value = useMemo(
    () => ({ yDoc: yDocRef.current, isConnected, isSynced, projectId, flowId }),
    [isConnected, isSynced, projectId, flowId],
  )

  useEffect(() => {
    if (!baseUrl) {
      throw new Error('[YJS] URL is not defined')
    }

    const yDoc = yDocRef.current
    const provider = new WebsocketProvider(
      baseUrl,
      `${projectId}/${flowId}`,
      yDoc,
    )
    yDoc.gc = true
    logger.info('[YJS] Initialized', baseUrl)

    provider.on('status', (event: { status: string }) => {
      logger.info('[YJS] Status', yDoc, event.status, new Date())
      if (event.status === 'connected') {
        setIsConnected(true)
      } else {
        setIsConnected(false)
      }
    })

    provider.on('sync', () => {
      // you received the initial content (e.g. the empty paragraph) from the other peers
      const endTime = performance.now()
      const loadTime = ((endTime - startTimeRef.current) / 1000).toFixed(2)

      logger.info(`[YJS] Data synced loadTime ${loadTime}s`, yDoc, new Date())
      setIsSynced(true)
    })

    return () => {
      provider?.destroy()
      yDoc.destroy()
    }
  }, [baseUrl, projectId])

  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>
}

export const useYjs = () => {
  const context = useContext(YjsContext)
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider')
  }
  return context
}
