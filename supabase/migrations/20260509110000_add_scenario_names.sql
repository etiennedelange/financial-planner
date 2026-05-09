-- Allow multiple named scenarios per user
alter table scenarios add column name text not null default 'My Plan';
alter table scenarios drop constraint scenarios_session_id_key;
