# Python script to copy an item, such as a feature service, from one ArcGIS Online Organization to another.
# You must have an account in both orgs, and the item id of the source item to copy.
# Run this with `python copyitem.py`

from arcgis.gis import GIS

username_source = input("Enter user name in source organization: ")
gis_source=GIS(r"https://arcgis.com", username_source)

username_target = input("Enter user name in target organization: ")
gis_target = GIS(r"https://arcgis.com", username_target)

item_id = input("Enter item id from source organization to copy: ")
items = gis_source.content.search(item_id) 

def deep_copy_items(item_list):
    copy_success = False
    for item in item_list:
        try:
            print("Cloning " + item.title)
            gis_target.content.clone_items(items=[item], copy_data=True, search_existing_items=True)
            copy_success = True
            print("Successfully cloned " + item.title)
        except Exception as e:
            copy_success = False
            print(e)
    if copy_success:
        print("Copy complete")
    else:
        print("Copy had errors")

deep_copy_items(items)
