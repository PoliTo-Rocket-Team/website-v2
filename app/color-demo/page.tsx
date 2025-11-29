import { notFound } from "next/navigation";

export default function ColorDemoPage() {
  // Return 404 in production environment
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white dark:bg-space-black transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-space-surface border-b border-gray-200 dark:border-mission-gray-3 transition-colors duration-300">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-gray-900 dark:text-cosmos-white text-2xl font-bold transition-colors duration-300">
              Space Mission Color Palette
            </h1>
            <p className="text-gray-600 dark:text-cosmos-secondary">
              Comprehensive showcase of the space mission color system
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-12">
        {/* Color Swatches */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Color Swatches
          </h2>

          {/* Background Colors */}
          <div className="mb-8">
            <h3 className="text-gray-700 dark:text-mission-gray-1 text-lg font-medium mb-4 transition-colors duration-300">
              Background Colors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-space-black rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-colors duration-300">
                <div className="text-cosmos-white font-medium mb-2">
                  Space Black
                </div>
                <div className="text-cosmos-secondary text-sm">#000000</div>
                <div className="text-cosmos-disabled text-xs mt-2">
                  Main background
                </div>
              </div>
              <div className="bg-space-surface rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-colors duration-300">
                <div className="text-cosmos-white font-medium mb-2">
                  Space Surface
                </div>
                <div className="text-cosmos-secondary text-sm">#111111</div>
                <div className="text-cosmos-disabled text-xs mt-2">
                  Cards & surfaces
                </div>
              </div>
              <div className="bg-space-surface-light rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-colors duration-300">
                <div className="text-cosmos-white font-medium mb-2">
                  Surface Light
                </div>
                <div className="text-cosmos-secondary text-sm">#1A1A1A</div>
                <div className="text-cosmos-disabled text-xs mt-2">
                  Light variant
                </div>
              </div>
            </div>
          </div>

          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="text-gray-700 dark:text-mission-gray-1 text-lg font-medium mb-4 transition-colors duration-300">
              Primary Colors (Rocket Theme)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-rocket rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-all duration-300 hover:scale-105">
                <div className="text-white font-medium mb-2">
                  Rocket Primary
                </div>
                <div className="text-white/80 text-sm">#FF4B00</div>
                <div className="text-white/60 text-xs mt-2">Main CTA color</div>
              </div>
              <div className="bg-rocket-hover rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-all duration-300 hover:scale-105">
                <div className="text-white font-medium mb-2">Rocket Hover</div>
                <div className="text-white/80 text-sm">#E04400</div>
                <div className="text-white/60 text-xs mt-2">Hover states</div>
              </div>
              <div className="bg-rocket-light rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-all duration-300 hover:scale-105">
                <div className="text-white font-medium mb-2">Rocket Light</div>
                <div className="text-white/80 text-sm">#FF8350</div>
                <div className="text-white/60 text-xs mt-2">Subtle accents</div>
              </div>
            </div>
          </div>

          {/* Mission Gray Colors */}
          <div className="mb-8">
            <h3 className="text-gray-700 dark:text-mission-gray-1 text-lg font-medium mb-4 transition-colors duration-300">
              Mission Gray Colors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-mission-gray-1 rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-all duration-300 hover:scale-105">
                <div className="text-gray-900 font-medium mb-2">
                  Mission Gray 1
                </div>
                <div className="text-gray-700 text-sm">#C4C4C4</div>
                <div className="text-gray-600 text-xs mt-2">
                  Logo white tone
                </div>
              </div>
              <div className="bg-mission-gray-2 rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-all duration-300 hover:scale-105">
                <div className="text-white font-medium mb-2">
                  Mission Gray 2
                </div>
                <div className="text-white/80 text-sm">#8A8A8A</div>
                <div className="text-white/60 text-xs mt-2">Text color</div>
              </div>
              <div className="bg-mission-gray-3 rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-all duration-300 hover:scale-105">
                <div className="text-white font-medium mb-2">
                  Mission Gray 3
                </div>
                <div className="text-white/80 text-sm">#3A3A3A</div>
                <div className="text-white/60 text-xs mt-2">
                  Dividers & strokes
                </div>
              </div>
            </div>
          </div>

          {/* Text Colors Demo */}
          <div className="mb-8">
            <h3 className="text-gray-700 dark:text-mission-gray-1 text-lg font-medium mb-4 transition-colors duration-300">
              Text Colors Demo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-space-surface rounded-lg p-6 border border-gray-300 dark:border-mission-gray-3 transition-colors duration-300">
                <h4 className="text-cosmos-white font-medium mb-3">
                  On Dark Background
                </h4>
                <div className="space-y-3">
                  <div className="text-cosmos-white text-lg">
                    Cosmos White - Primary Text (#EDEDED)
                  </div>
                  <div className="text-cosmos-secondary">
                    Cosmos Secondary - Supporting Text (#A8A8A8)
                  </div>
                  <div className="text-cosmos-disabled">
                    Cosmos Disabled - Muted Text (#6A6A6A)
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-100 rounded-lg p-6 border border-gray-300 dark:border-gray-200 transition-colors duration-300">
                <h4 className="text-gray-900 font-medium mb-3">
                  On Light Background
                </h4>
                <div className="space-y-3">
                  <div className="text-gray-900 text-lg">
                    Primary Text (Adaptive)
                  </div>
                  <div className="text-gray-600">Secondary Text (Adaptive)</div>
                  <div className="text-gray-400">Disabled Text (Adaptive)</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Button Examples */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Button Components
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button className="bg-rocket hover:bg-rocket-hover text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
              Primary Action
            </button>
            <button className="bg-rocket-light hover:bg-rocket text-white dark:text-space-black px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105">
              Secondary Action
            </button>
            <button className="bg-transparent border-2 border-rocket text-rocket hover:bg-rocket hover:text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105">
              Outline Button
            </button>
            <button className="bg-gray-100 hover:bg-gray-200 dark:bg-space-surface dark:hover:bg-space-surface-light border border-gray-300 dark:border-mission-gray-3 text-gray-900 dark:text-cosmos-white px-6 py-3 rounded-lg font-semibold transition-all duration-300">
              Adaptive Button
            </button>
            <button className="text-rocket hover:text-rocket-hover font-semibold transition-all duration-300 hover:underline">
              Link Button
            </button>
            <button className="bg-gray-500 hover:bg-gray-600 dark:bg-mission-gray-3 dark:hover:bg-mission-gray-2 text-white dark:text-cosmos-white px-6 py-3 rounded-lg font-semibold transition-all duration-300">
              Muted Button
            </button>
          </div>
        </section>

        {/* Card Examples */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Card Components
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mission Card */}
            <div className="bg-white dark:bg-space-surface rounded-xl p-6 border border-gray-200 dark:border-mission-gray-3 transition-all duration-300 hover:shadow-lg hover:shadow-rocket/10 dark:hover:shadow-rocket/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-900 dark:text-cosmos-white text-lg font-semibold transition-colors duration-300">
                  Mars Rover Mission
                </h3>
                <span className="bg-rocket-light text-white px-3 py-1 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
              <p className="text-gray-600 dark:text-cosmos-secondary mb-4 transition-colors duration-300">
                Exploring the Martian surface for signs of ancient life and
                geological formations.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-mission-gray-2 text-sm transition-colors duration-300">
                  Progress: 78%
                </span>
                <button className="text-rocket hover:text-rocket-hover font-medium transition-all duration-300 hover:translate-x-1">
                  View Details →
                </button>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-gray-50 dark:bg-space-surface-light rounded-xl p-6 border border-gray-200 dark:border-mission-gray-3 transition-all duration-300 hover:shadow-lg">
              <h3 className="text-gray-900 dark:text-cosmos-white text-lg font-semibold mb-4 transition-colors duration-300">
                Mission Control Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-cosmos-secondary transition-colors duration-300">
                    Fuel Level
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    98%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-cosmos-secondary transition-colors duration-300">
                    Oxygen
                  </span>
                  <span className="text-rocket font-medium">Low</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-cosmos-secondary transition-colors duration-300">
                    Communication
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form Example */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Form Components
          </h2>
          <div className="max-w-md">
            <form className="bg-white dark:bg-space-surface p-6 rounded-lg border border-gray-200 dark:border-mission-gray-3 transition-colors duration-300">
              <div className="mb-4">
                <label className="block text-gray-700 dark:text-cosmos-white text-sm font-medium mb-2 transition-colors duration-300">
                  Mission Name
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-50 dark:bg-space-surface-light border border-gray-300 dark:border-mission-gray-3 rounded-md px-3 py-2 text-gray-900 dark:text-cosmos-white placeholder-gray-400 dark:placeholder-cosmos-disabled focus:border-blue-500 dark:focus:border-rocket focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-rocket/20 transition-all duration-300"
                  placeholder="Enter mission name"
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 dark:text-cosmos-white text-sm font-medium mb-2 transition-colors duration-300">
                  Mission Type
                </label>
                <select className="w-full bg-gray-50 dark:bg-space-surface-light border border-gray-300 dark:border-mission-gray-3 rounded-md px-3 py-2 text-gray-900 dark:text-cosmos-white focus:border-blue-500 dark:focus:border-rocket focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-rocket/20 transition-all duration-300">
                  <option>Exploration</option>
                  <option>Research</option>
                  <option>Supply</option>
                  <option>Rescue</option>
                </select>
              </div>

              <button className="w-full bg-rocket hover:bg-rocket-hover text-white py-3 rounded-md font-semibold transition-all duration-300 transform hover:scale-105">
                Launch Mission
              </button>
            </form>
          </div>
        </section>

        {/* Navigation Example */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Navigation Components
          </h2>
          <nav className="bg-white dark:bg-space-surface border border-gray-200 dark:border-mission-gray-3 rounded-lg p-4 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <h3 className="text-gray-900 dark:text-cosmos-white font-bold transition-colors duration-300">
                  🚀 Mission Control
                </h3>
                <div className="hidden md:flex space-x-6">
                  <a
                    href="#"
                    className="text-rocket hover:text-rocket-hover font-medium transition-all duration-300 hover:underline"
                  >
                    Dashboard
                  </a>
                  <a
                    href="#"
                    className="text-gray-600 dark:text-mission-gray-1 hover:text-gray-900 dark:hover:text-cosmos-white transition-all duration-300"
                  >
                    Missions
                  </a>
                  <a
                    href="#"
                    className="text-gray-600 dark:text-mission-gray-1 hover:text-gray-900 dark:hover:text-cosmos-white transition-all duration-300"
                  >
                    Crew
                  </a>
                  <a
                    href="#"
                    className="text-gray-600 dark:text-mission-gray-1 hover:text-gray-900 dark:hover:text-cosmos-white transition-all duration-300"
                  >
                    Analytics
                  </a>
                </div>
              </div>
              <button className="bg-rocket hover:bg-rocket-hover text-white px-4 py-2 rounded-md transition-all duration-300 transform hover:scale-105">
                New Mission
              </button>
            </div>
          </nav>
        </section>

        {/* Status Indicators */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Status Indicators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-3 animate-pulse"></div>
                <span className="text-green-700 dark:text-green-300 font-medium">
                  Mission Successful
                </span>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-rocket/20 border border-orange-200 dark:border-rocket rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-rocket rounded-full mr-3 animate-pulse"></div>
                <span className="text-orange-700 dark:text-rocket-light font-medium">
                  Attention Required
                </span>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full mr-3 animate-pulse"></div>
                <span className="text-red-700 dark:text-red-300 font-medium">
                  Mission Failed
                </span>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3 animate-pulse"></div>
                <span className="text-blue-700 dark:text-blue-300 font-medium">
                  In Progress
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Typography Hierarchy */}
        <section>
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Typography Hierarchy
          </h2>
          <div className="bg-white dark:bg-space-surface p-6 rounded-lg border border-gray-200 dark:border-mission-gray-3 transition-colors duration-300">
            <h1 className="text-gray-900 dark:text-cosmos-white text-3xl font-bold mb-4 transition-colors duration-300">
              Main Heading (H1)
            </h1>
            <h2 className="text-gray-800 dark:text-mission-gray-1 text-xl font-semibold mb-3 transition-colors duration-300">
              Section Heading (H2)
            </h2>
            <h3 className="text-gray-700 dark:text-cosmos-secondary text-lg font-medium mb-3 transition-colors duration-300">
              Subsection Heading (H3)
            </h3>
            <p className="text-gray-600 dark:text-cosmos-secondary mb-4 transition-colors duration-300">
              This is regular paragraph text that provides context and
              information about the mission objectives and current status. It
              demonstrates how body text appears in both light and dark modes
              with proper contrast ratios.
            </p>
            <p className="text-gray-500 dark:text-cosmos-disabled text-sm transition-colors duration-300">
              Small text for metadata, timestamps, or additional details that
              are less important but still readable.
            </p>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-space-surface-light rounded border-l-4 border-rocket transition-colors duration-300">
              <p className="text-gray-700 dark:text-mission-gray-1 font-medium transition-colors duration-300">
                💡 Pro Tip
              </p>
              <p className="text-gray-600 dark:text-cosmos-secondary text-sm mt-1 transition-colors duration-300">
                Use the rocket orange sparingly for maximum impact. It should
                primarily be used for primary actions and important highlights.
              </p>
            </div>
          </div>
        </section>

        {/* Theme Information */}
        <section className="border-t border-gray-200 dark:border-mission-gray-3 pt-8">
          <h2 className="text-gray-900 dark:text-cosmos-white text-xl font-semibold mb-6 transition-colors duration-300">
            Theme Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-space-surface p-6 rounded-lg transition-colors duration-300">
              <h3 className="text-gray-900 dark:text-cosmos-white font-semibold mb-3">
                Theme Features
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-cosmos-secondary text-sm">
                <li>• Adapts to your app's theme setting</li>
                <li>• Smooth transitions between modes</li>
                <li>• Optimized for accessibility</li>
                <li>• Consistent across all components</li>
              </ul>
            </div>
            <div className="bg-rocket/10 dark:bg-rocket/20 p-6 rounded-lg border border-rocket/20">
              <h3 className="text-gray-900 dark:text-cosmos-white font-semibold mb-3">
                Space Mission Colors
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-rocket-light text-sm">
                <li>• 🚀 Rocket Orange: Primary actions</li>
                <li>• 🌌 Space Blacks: Backgrounds</li>
                <li>• 🛸 Mission Grays: Supporting elements</li>
                <li>• ✨ Cosmos Whites: Text hierarchy</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
