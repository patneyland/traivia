import { Route, Switch } from "wouter";
import { Home } from "./Home";
import { CreateRoom } from "./CreateRoom";
import { JoinRoom } from "./JoinRoom";
import { Room } from "./Room";

export function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create-room" component={CreateRoom} />
      <Route path="/join-room" component={JoinRoom} />
      <Route path="/room/:code" component={Room} />
      <Route component={Home} />
    </Switch>
  );
}
