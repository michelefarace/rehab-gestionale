# Rehab — Gestionale Studio di Chinesiologia

Applicazione web privata (protetta da password) per gestire **appuntamenti, pazienti e contabilità** dello Studio Rehab — Via Provinciale 225, Gugnano.

Funzioni principali:

- **Dashboard**: agenda di oggi, entrate/uscite del mese, importi da incassare.
- **Agenda**: appuntamenti per periodo, con stato (programmato / completato / annullato) e incasso rapido.
- **Pazienti**: anagrafica completa, scheda con storico appuntamenti e pagamenti, note/anamnesi.
- **Contabilità**: entrate e spese con categorie, filtri per periodo, saldo.
- **Listino**: tipi di seduta con durata e prezzo predefinito.
- **Ricevute**: numerazione automatica per anno, stampa/PDF, registrazione automatica dell'entrata.
- **Report**: grafici entrate/uscite per mese, sedute completate, uscite per categoria.
- **Impostazioni**: dati dello studio che compaiono sulle ricevute.

I dati restano **tuoi**, salvati in un database SQLite sul tuo servizio Railway.

---

## Come pubblicarlo online (GitHub + Railway)

### 1. Carica il progetto su GitHub
1. Crea un nuovo repository su GitHub (es. `rehab-gestionale`), privato.
2. Carica tutti i file di questa cartella nel repository (puoi trascinarli nella pagina "uploading an existing file", **escludendo** le cartelle `node_modules` e `data` se presenti).

### 2. Crea il progetto su Railway
1. Su Railway: **New Project → Deploy from GitHub repo** e seleziona il repository appena creato.
2. Railway rileva Node.js e avvia la build automaticamente.

### 3. Imposta le variabili d'ambiente
Nel servizio, apri **Variables** e aggiungi:

| Variabile | Valore |
|---|---|
| `APP_PASSWORD` | la password con cui accederai al gestionale |
| `SESSION_SECRET` | una stringa lunga e casuale (es. 30+ caratteri) |
| `DATA_DIR` | `/data` |

### 4. Aggiungi il disco per salvare i dati (IMPORTANTE)
Senza questo passaggio i dati si perdono ad ogni aggiornamento.
1. Nel servizio: **Settings → Volumes → New Volume** (oppure il pulsante "+ Volume").
2. Imposta il **Mount path** su `/data`.
3. Salva. Railway riavvierà il servizio.

> Se compare un errore di permessi sul volume, aggiungi anche la variabile `RAILWAY_RUN_UID` con valore `0`.

> Tutti i dati vengono salvati in un unico file `rehab.json` dentro la cartella `/data` del volume. L'app non usa dipendenze da compilare, quindi la build su Railway è veloce e affidabile.

### 5. Genera il dominio pubblico
1. **Settings → Networking → Generate Domain**.
2. Apri l'indirizzo `.up.railway.app` generato: comparirà la schermata di login.
3. Inserisci la password scelta in `APP_PASSWORD`. Fatto!

Salva il link nei preferiti del browser (o come app sulla home dello smartphone) per accedervi ogni giorno.

---

## Provarlo sul tuo computer (facoltativo)

```bash
npm install
# crea un file .env oppure imposta le variabili a mano
APP_PASSWORD=prova SESSION_SECRET=qualcosa npm start
```

Poi apri http://localhost:3000

---

## Note

- App pensata per **un solo utente** (tu). L'accesso è protetto da un'unica password.
- Le ricevute generate sono documenti stampabili; verifica con il tuo commercialista gli obblighi fiscali applicabili alla tua attività.
- Backup: puoi scaricare periodicamente il file del database dal volume Railway, oppure chiedimi di aggiungere un pulsante di esportazione.
