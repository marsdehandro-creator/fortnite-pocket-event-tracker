import { EventsTracker } from "./components/EventsTracker";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { StructuredData } from "./components/StructuredData";
import { TopBar } from "./components/TopBar";
import { UpdateTracker } from "./components/UpdateTracker";
import { useNow } from "./hooks/useNow";
import { useTrackerData } from "./hooks/useTrackerData";
import { getScheduleStatus } from "./utils/status";

export function App() {
  const now = useNow();
  const { data } = useTrackerData();
  const schedule = getScheduleStatus(data.updates, now);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar now={now} tone={schedule.tone} />
      <main id="main" className="page">
        <Hero now={now} updates={data.updates} events={data.events} />
        <UpdateTracker updates={data.updates} now={now} />
        <EventsTracker events={data.events} now={now} />
      </main>
      <Footer data={data} />
      <StructuredData events={data.events} now={now} />
    </>
  );
}
