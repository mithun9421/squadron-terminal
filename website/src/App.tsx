import { Nav } from "./components/Nav";
import { Hero } from "./sections/Hero";
import { FeatureGrid } from "./sections/FeatureGrid";
import { HowItsBuilt } from "./sections/HowItsBuilt";
import { Download } from "./sections/Download";
import { Footer } from "./sections/Footer";

function App() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Nav />
      <Hero />
      <FeatureGrid />
      <HowItsBuilt />
      <Download />
      <Footer />
    </div>
  );
}

export default App;
