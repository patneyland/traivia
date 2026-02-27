import { Route, Switch } from "wouter";
import { Home } from "./Home";
import { Room } from "./Room";

export function App() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-10">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/room/:code" component={Room} />
      </Switch>
    </div>
  );
}
