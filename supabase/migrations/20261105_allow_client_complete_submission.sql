-- Les clients n'avaient aucune politique RLS leur permettant de mettre à jour
-- leur propre demande (seul l'admin avait un droit UPDATE). Résultat : quand un
-- client complétait un dossier "À compléter" depuis le site, la mise à jour était
-- silencieusement bloquée par RLS (0 ligne modifiée, sans erreur renvoyée), alors
-- que l'e-mail de notification admin partait quand même.
--
-- On autorise donc le client à compléter sa propre demande, mais seulement pour
-- repasser un dossier de "needs_info" à "pending" sans pouvoir s'auto-attribuer
-- de points ni changer de compte.
create policy "Users can complete their own needs_info submissions"
on public.loyalty_submissions
for update
to authenticated
using (auth.uid() = user_id and status = 'needs_info')
with check (auth.uid() = user_id and status = 'pending' and points_awarded = 0);
