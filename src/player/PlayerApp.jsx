import { useGameStore } from '../store/gameStore'
import { useWs } from '../contexts/WebSocketContext'
import JoinScreen from './JoinScreen'
import BuzzerScreen from './BuzzerScreen'
import WinnerOverlay from './WinnerOverlay'
import PositionOverlay from './PositionOverlay'
import ChoiceOverlay from './ChoiceOverlay'
import ConnDot from '../components/ConnDot'

export default function PlayerApp() {
  const myId = useGameStore(s => s.myId)
  const myColor = useGameStore(s => s.myColor)
  const winner = useGameStore(s => s.winner)
  const winnerId = useGameStore(s => s.winnerId)
  const winnerColor = useGameStore(s => s.winnerColor)
  const buzzOrder = useGameStore(s => s.buzzOrder)
  const currentTrack = useGameStore(s => s.currentTrack)
  const locked = useGameStore(s => s.locked)
  const awaitingChoice = useGameStore(s => s.awaitingChoice)
  const { connected } = useWs()

  const hasBuzzed = !!myId && buzzOrder.some(b => b.id === myId)
  const myPosition = hasBuzzed ? buzzOrder.findIndex(b => b.id === myId) + 1 : null
  const isWinner = !!winner && winnerId === myId
  const isLocked = locked && !!winner

  return (
    <>
      <ConnDot connected={connected} fixed />
      {!myId ? (
        <JoinScreen />
      ) : (
        <>
          <BuzzerScreen
            myColor={myColor}
            hasBuzzed={hasBuzzed}
            isLocked={isLocked}
            winner={winner}
          />
          {isWinner && (
            <WinnerOverlay
              winnerColor={winnerColor}
              winnerName={winner}
              currentTrack={currentTrack}
            />
          )}
          {!isWinner && hasBuzzed && (
            <PositionOverlay
              position={myPosition}
              myColor={myColor}
              isLocked={isLocked}
              winner={winner}
            />
          )}
          {!isWinner && !hasBuzzed && awaitingChoice && <ChoiceOverlay />}
        </>
      )}
    </>
  )
}
