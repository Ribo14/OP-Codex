# Backup cifrati gestiti da noi

Il piano gratuito di Supabase non ha backup. Un GitHub Action settimanale fa il dump del database, lo cifra e lo salva in una destinazione privata esterna, conservando le ultime 8 copie. La cifratura è obbligatoria: il repo è pubblico e i dump contengono dati personali, quindi un dump in chiaro non deve mai esistere fuori dal database. Prima del lancio si esegue almeno un ripristino di prova.
