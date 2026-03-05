import { CsvImporter } from "@components/CsvImporter";
import { LobbySelector } from "@components/LobbySelector";
import { TeamDisplay } from "@components/TeamDisplay";
import { BalanceButton } from "@components/BalanceButton";
import { ConstraintsPanel } from "@components/ConstraintsPanel";
import { StatsPanel } from "@components/StatsPanel";
import { Leaderboard } from "@components/Leaderboard";
import { SpectatorsList } from "@components/SpectatorsList";
import { useSessionStore } from "@store/sessionStore";

function App() {
  const lastResult = useSessionStore((state) => state.lastResult);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-center">
          Swoo's Stadium PUGs Balancer
        </h1>
      </header>

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column: Import & Lobby (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <CsvImporter />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <LobbySelector />
            </div>
          </div>

          {/* Center/Right: Balance + Team Composition + Constraints (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <BalanceButton />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Team Composition</h2>
              <TeamDisplay result={lastResult} />
            </div>
            <SpectatorsList />
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <ConstraintsPanel />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <StatsPanel />
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <Leaderboard />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;