use std::collections::HashMap;

use crate::types::{ComponentRecord, TreeNode};

/// Build a tree of components from flat records.
/// Mirrors TypeScript Registry.tree() — but avoids cloning strings
/// by working directly with the deserialized records.
pub fn build_tree(records: Vec<ComponentRecord>) -> Vec<TreeNode> {
    let mut nodes: HashMap<u32, TreeNode> = HashMap::with_capacity(records.len());

    // Create tree nodes from flat records.
    for record in records {
        nodes.insert(
            record.uid,
            TreeNode {
                uid: record.uid,
                name: record.name,
                file: record.file,
                parent_uid: record.parent_uid,
                mounted_at: record.mounted_at,
                render_count: record.render_count,
                update_count: record.update_count,
                flash_count: record.flash_count,
                total_duration: record.total_duration,
                max_duration: record.max_duration,
                last_duration: record.last_duration,
                last_render_at: record.last_render_at,
                last_reasons: record.last_reasons,
                last_prop_changes: record.last_prop_changes,
                children: Vec::new(),
                subtree_renders: record.render_count,
                depth: 0,
            },
        );
    }

    // Collect parent→children relationships.
    let mut parent_map: HashMap<u32, Vec<u32>> = HashMap::new();
    let mut root_uids: Vec<u32> = Vec::new();

    // Collect UIDs in sorted order so iteration is deterministic
    // (HashMap has no guaranteed order; JS Map preserves insertion order).
    let mut all_uids: Vec<u32> = nodes.keys().copied().collect();
    all_uids.sort();

    for &uid in &all_uids {
        let node = &nodes[&uid];
        match node.parent_uid {
            Some(pid) if nodes.contains_key(&pid) => {
                parent_map.entry(pid).or_default().push(uid);
            }
            _ => {
                root_uids.push(uid);
            }
        }
    }

    // Build the tree bottom-up: extract children from the flat map.
    fn extract_subtree(
        uid: u32,
        nodes: &mut HashMap<u32, TreeNode>,
        parent_map: &HashMap<u32, Vec<u32>>,
        depth: u32,
    ) -> Option<TreeNode> {
        let child_uids: Vec<u32> = parent_map.get(&uid).cloned().unwrap_or_default();

        let mut children = Vec::with_capacity(child_uids.len());
        let mut subtree_total: u32 = 0;

        for child_uid in child_uids {
            if let Some(mut child) = extract_subtree(child_uid, nodes, parent_map, depth + 1) {
                subtree_total += child.subtree_renders;
                child.depth = depth + 1;
                children.push(child);
            }
        }

        nodes.remove(&uid).map(|mut node| {
            node.depth = depth;
            node.subtree_renders = node.render_count + subtree_total;
            node.children = children;
            node
        })
    }

    root_uids
        .iter()
        .filter_map(|&uid| extract_subtree(uid, &mut nodes, &parent_map, 0))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ComponentRecord;

    fn make_record(uid: u32, name: &str, parent: Option<u32>, renders: u32) -> ComponentRecord {
        ComponentRecord {
            uid,
            name: name.to_string(),
            file: None,
            parent_uid: parent,
            mounted_at: 0.0,
            render_count: renders,
            update_count: 0,
            flash_count: 0,
            total_duration: 0.0,
            max_duration: 0.0,
            last_duration: 0.0,
            last_render_at: 0.0,
            last_reasons: vec![],
            last_prop_changes: vec![],
        }
    }

    #[test]
    fn empty_input_returns_empty() {
        let tree = build_tree(vec![]);
        assert!(tree.is_empty());
    }

    #[test]
    fn single_root_no_children() {
        let tree = build_tree(vec![make_record(1, "App", None, 3)]);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].name, "App");
        assert_eq!(tree[0].depth, 0);
        assert_eq!(tree[0].subtree_renders, 3);
        assert!(tree[0].children.is_empty());
    }

    #[test]
    fn builds_tree_with_subtree_renders() {
        let records = vec![
            make_record(1, "App", None, 2),
            make_record(2, "Header", Some(1), 5),
            make_record(3, "Footer", Some(1), 1),
            make_record(4, "Logo", Some(2), 3),
        ];

        let tree = build_tree(records);
        assert_eq!(tree.len(), 1);

        let app = &tree[0];
        assert_eq!(app.name, "App");
        assert_eq!(app.depth, 0);
        // App(2) + Header(5) + Footer(1) + Logo(3) = 11
        assert_eq!(app.subtree_renders, 11);
        assert_eq!(app.children.len(), 2);

        let header = app.children.iter().find(|n| n.name == "Header").unwrap();
        assert_eq!(header.depth, 1);
        // Header(5) + Logo(3) = 8
        assert_eq!(header.subtree_renders, 8);
        assert_eq!(header.children.len(), 1);

        let logo = &header.children[0];
        assert_eq!(logo.depth, 2);
        assert_eq!(logo.subtree_renders, 3);
    }

    #[test]
    fn orphan_becomes_root() {
        let records = vec![
            make_record(1, "App", None, 1),
            make_record(5, "Orphan", Some(99), 2), // parent 99 doesn't exist
        ];

        let tree = build_tree(records);
        assert_eq!(tree.len(), 2);
    }

    #[test]
    fn deep_linear_chain() {
        // A → B → C → D → E (depth 4)
        let records = vec![
            make_record(1, "A", None, 1),
            make_record(2, "B", Some(1), 1),
            make_record(3, "C", Some(2), 1),
            make_record(4, "D", Some(3), 1),
            make_record(5, "E", Some(4), 1),
        ];

        let tree = build_tree(records);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].subtree_renders, 5);
        assert_eq!(tree[0].depth, 0);

        // Walk the chain.
        let mut node = &tree[0];
        for expected_depth in 0..5u32 {
            assert_eq!(node.depth, expected_depth);
            if expected_depth < 4 {
                assert_eq!(node.children.len(), 1);
                node = &node.children[0];
            }
        }
        assert_eq!(node.name, "E");
        assert!(node.children.is_empty());
    }

    #[test]
    fn multiple_roots() {
        let records = vec![
            make_record(1, "App1", None, 3),
            make_record(2, "App2", None, 7),
            make_record(3, "Child1", Some(1), 1),
            make_record(4, "Child2", Some(2), 2),
        ];

        let tree = build_tree(records);
        assert_eq!(tree.len(), 2);

        let totals: u32 = tree.iter().map(|r| r.subtree_renders).sum();
        assert_eq!(totals, 13); // 3+1 + 7+2
    }

    #[test]
    fn zero_renders_propagate() {
        let records = vec![
            make_record(1, "App", None, 0),
            make_record(2, "Child", Some(1), 0),
        ];

        let tree = build_tree(records);
        assert_eq!(tree[0].subtree_renders, 0);
        assert_eq!(tree[0].children[0].subtree_renders, 0);
    }

    #[test]
    fn parent_uid_null_is_root() {
        // parentUid: None should always be a root, even with uid 0.
        let records = vec![
            make_record(0, "Root", None, 1),
            make_record(1, "Child", Some(0), 2),
        ];

        let tree = build_tree(records);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].uid, 0);
        assert_eq!(tree[0].children.len(), 1);
    }

    #[test]
    fn wide_tree_many_siblings() {
        let mut records = vec![make_record(0, "Root", None, 1)];
        for i in 1..=100u32 {
            records.push(make_record(i, &format!("Child{}", i), Some(0), 1));
        }

        let tree = build_tree(records);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].children.len(), 100);
        assert_eq!(tree[0].subtree_renders, 101); // 1 + 100
    }

    #[test]
    fn preserves_component_fields() {
        let mut record = make_record(42, "MyComp", None, 10);
        record.file = Some("src/MyComp.vue".to_string());
        record.mounted_at = 123.456;
        record.total_duration = 99.9;
        record.max_duration = 15.0;
        record.update_count = 8;

        let tree = build_tree(vec![record]);
        let node = &tree[0];
        assert_eq!(node.uid, 42);
        assert_eq!(node.file, Some("src/MyComp.vue".to_string()));
        assert_eq!(node.mounted_at, 123.456);
        assert_eq!(node.total_duration, 99.9);
        assert_eq!(node.max_duration, 15.0);
        assert_eq!(node.update_count, 8);
    }
}
