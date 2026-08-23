-- JD-prep feature: a node_kind for the auto-generated "prep for this job" parent,
-- so the UI can identify it and offer "dismantle" without a separate flag column.
alter table nodes drop constraint if exists nodes_node_kind_check;
alter table nodes
  add constraint nodes_node_kind_check
  check (node_kind in ('topic', 'project', 'profile_root', 'jd_prep'));
