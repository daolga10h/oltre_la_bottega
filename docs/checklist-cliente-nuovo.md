# Cosa serve per attivare una nuova bottega

Checklist per l'attivazione di una nuova istanza (modello single-tenant: ogni bottega ha il proprio account Supabase + Vercel, gestito in autonomia). Divisa per chi se ne occupa: la creazione tecnica degli account è a mio carico, anche quando restano intestati al cliente — al cliente serve solo il minimo che gli è effettivamente richiesto.

## Cosa faccio io (sviluppatore)

### Indispensabile

- Creare il progetto Supabase a nome del cliente (con la sua email) e applicare le migration in ordine (schema v2 + successive, vedi CLAUDE.md).
- Creare l'account Vercel a nome del cliente, configurare le variabili d'ambiente (URL/anon key/service role key Supabase) e fare il deploy dell'istanza dedicata.
- Creare l'utente Supabase Auth della bottega e guidare l'impostazione del PIN condiviso da Impostazioni al primo accesso.
- Verificare end-to-end il funzionamento su almeno un dispositivo reale del cliente prima della consegna.

### Facoltativo

- Creare l'account Resend a nome del cliente (con la sua email — non la mia, altrimenti l'email di backup non arriva), impostare `RESEND_API_KEY` su Vercel e verificare che il backup settimanale arrivi davvero.
- Configurare SimpleBackups + Google Drive per il backup tecnico giornaliero — non ancora uno step standard, da definire quando verrà attivato (vedi CLAUDE.md, roadmap).
- Verificare la stampa etichette se il cliente ha una stampante compatibile (Mopria/AirPrint).
- Segnalare al cliente l'opzione Vercel Pro se vuole essere formalmente in regola con i termini "non commerciale" del piano gratuito.

## Cosa serve al cliente finale

### Indispensabile

- Un indirizzo email della bottega.
- Un dispositivo con browser e connessione internet per l'uso quotidiano (tablet, PC o smartphone).
- Decidere e ricordare il PIN condiviso della bottega (un solo PIN per tutti, non un accesso per persona).

### Facoltativo

- Una stampante etichette compatibile Mopria/AirPrint (es. Brother QL), se vuole stampare le etichette con QR code degli ordini.
- Disponibilità a passare a Vercel Pro (~20€/mese) se preferisce essere formalmente in regola con i termini di servizio invece di restare sul piano gratuito.
