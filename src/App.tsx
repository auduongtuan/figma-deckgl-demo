import './App.css'
import { HookBasedDemo } from './components/HookBasedDemo'

function App() {
  return (
    <div className="App">
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        zIndex: 1000,
        background: 'white',
        padding: '8px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '6px 12px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          DeckGL Transformation Library - Hook Integration
        </div>
      </div>
      
      <HookBasedDemo />
    </div>
  )
}

export default App