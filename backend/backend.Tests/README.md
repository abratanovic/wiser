# Backend tests

Needs only Docker (Testcontainers starts a throwaway `postgres:16`). From `backend/`:

```sh
dotnet test
```

- `ApiFactory` boots the real app in-process (`WebApplicationFactory<Program>`) against that database, with the Wise source replaced by `StubWiseSource`, so nothing reaches wise-tt.com.
- Test classes join `[Collection("api")]` and share one app and database. Isolate tests with `api.CreateSignedInClientAsync()`, which signs up a fresh user and returns a client with its bearer token.
- Drive everything through HTTP and assert on responses, never on EF entities.
