# 🦊 GUIDE DE SURVIE GIT : GESTION V1 vs V2

Ce fichier sert d'aide-mémoire pour naviguer entre la version stable (V1 - branche `main`) et la nouvelle architecture en développement (V2 - branche `v2-refonte`).

---

## 0. La routine quotidienne (Add - Commit - Push)
Assurez-vous d'être sur la bonne branche (git checkout v2-refonte), puis :

# 1. Préparer les fichiers (Mise dans le carton)
git add .

# 2. Valider les modifications (Fermer le carton avec une étiquette)
git commit -m "Description de ce que j'ai changé dans la v2"

# 3. Envoyer vers GitLab (Expédier le camion)
git push origin v2-refonte

---

## 1. Démarrer (ou reprendre) la Version 2
*Objectif : Travailler sur la nouvelle architecture sans casser la version stable.*

# 1. Vérifier sur quelle branche on se trouve
git status

# 2. Si je veux commencer la V2 pour la première fois :
git checkout -b v2-refonte

# 3. Si la branche existe déjà et que je veux retourner dessus :
git checkout v2-refonte

---

## 2. SCÉNARIO D'URGENCE : Corriger un bug sur la V1
Situation : Je suis en train de travailler sur v2-refonte, c'est le chantier, mais je dois fixer un truc urgent sur la main (V1).

# Étape A : Sauvegarder le chantier V2
⚠️ Important : Git refuse de changer de branche si le travail n'est pas sauvegardé.

git add .
git commit -m "WIP: Sauvegarde temporaire du chantier avant bascule v1"
(WIP = Work In Progress. On sauvegarde même si le code ne marche pas).

# Étape B : Retourner sur la V1

git checkout main
👀 Regarde tes dossiers : Tes fichiers sont redevenus exactement comme ils étaient en V1. La V2 est cachée.

# Étape C : Faire la correction et l'envoyer
Une fois le bug corrigé dans le code :


git add .
git commit -m "FIX: Correction bug critique sur la V1"
git push origin main

# Étape D : Retourner sur la V2

git checkout v2-refonte
👀 Regarde tes dossiers : Tu es revenu dans le futur. Tes fichiers V2 sont là.

---

## 3. Récupérer le correctif V1 dans la V2
Situation : Le bug corrigé sur main est aussi présent dans la V2. Je veux récupérer la correction sans copier-coller.

# 1. S'assurer d'être sur la v2
git checkout v2-refonte

# 2. Fusionner ce qui a été fait sur main
git merge main

---

## 4. Terminer la V2 (Le Grand Remplacement)
Situation : La V2 est finie, testée et prête. Elle doit devenir la version officielle.

# 1. Retourner sur la branche principale
git checkout main

# 2. Fusionner la v2 dans la main
git merge v2-refonte

# 3. Envoyer la nouvelle version officielle sur GitLab
git push origin main