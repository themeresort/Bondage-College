'use strict'

var LocationPlayer = function(Account){
	console.log("building character " + Account.id + " " + Object.keys(Account));
	for(var key in Account)
		this[key] = Account[key];
	
	this.currentPose = F3dcgAssets.POSE_NONE;
	
	this.render = F3dcgAssetsRender.BuildPlayerRender(this.appearance, this.currentPose);
	
	this.GetUpdateDelegate = function(){
		this.update = new LocationPlayerUpdate(this);
		return this.update;
	}
	
	this.UpdateApearance = function(AppearanceItems){
		AppearanceItems.forEach(AppItemUpdate => {
			if(AppItemUpdate.Name == "None"){
				this.Appearance = this.Appearance.filter(AppItem => AppItem.Group != AppItemUpdate.Group);
			}else{
				var AppItemToModify = this.Appearance.find(AppItemExisting => AppItemExisting.Group == AppItemUpdate.Group);
				
				if(! AppItemToModify) {
					this.Appearance.push(AppItemUpdate);
				}else{
					Util.ReplaceInPlace(AppItemToModify, AppItemUpdate)
				}
			}
		});
		this.appearance = F3dcgAssets.BuildPlayerAppearance(MainController.playerAccount, this, this.Appearance);
		this.inventory = F3dcgAssets.BuildPlayerInventory(MainController.playerAccount, this, this.Inventory, this.appearance);
	}
	
	/*
	this.interval = setInterval(function(){
		this.Appearance.forEach(AppearanceItem => {
			if(AppearanceItem.Property?.RemoveTimer && AppearanceItem.Property?.RemoveTimer - new Date().getTime() < 0){
				if(AppearanceItem.Property.RemoveItem){
					this.Appearance = this.Appearance.filter(el => el != AppearanceItem);
					this.appearance = F3dcgAssets.BuildPlayerAppearance(MainController.playerAccount, this, this.Appearance);
					this.inventory = F3dcgAssets.BuildPlayerInventory(MainController.playerAccount, this, this.Inventory, this.appearance);					
					this.update?.OnItemUpdate();
				}else{
					delete AppearanceItem.Property.RemoveTimer;
					delete AppearanceItem.Property.RemoveItem;
					delete AppearanceItem.Property.LockedBy;
					delete AppearanceItem.Property.LockMemberNumber;
				}
			}
		});
	}.bind(this), 1000);*/
	
}


var LocationPlayerUpdate = function(player){
	this.player = player;
	
	this.appearance = Util.CloneRecursive(player.appearance);
	this.render = Util.CloneRecursive(player.render);
	this.inventory = Util.CloneRecursive(player.inventory);
	
	//this.clothOrAccessoryUpdateLimit = 3;
	this.clothOrAccessoryUpdateLimit = 100;//unlimited
	this.updateStack = [];
	this.wardrobe = null;
	
	
	this.AddWardrobe = function(appearanceItems){
		console.log(appearanceItems);
		this.wardrobe = Object.values(appearanceItems);
		this.wardrobe.forEach(appearanceItem => {
			F3dcgAssets.DeconvertItemAndUpdateAppearance(this.Appearance, appearanceItem);
		});
		this.appearance = F3dcgAssets.BuildPlayerAppearance(MainController.playerAccount, this.player, this.Appearance);	
		return [];
	}
	
	this.Add = function(appearanceItem){
		if(this.wardrobe) return ["CanNotAddAfterWardrobe"];
		
		var itemGroupName = appearanceItem.itemGroupName, itemName = appearanceItem.itemName, itemGroupTypeName = appearanceItem.itemGroupTypeName;
		
		//if(this.appearance.items[appearanceItem.itemGroupName]?.itemName == itemName)	return ["SameItem"];//same item when change color or lock or variant
		if(! this.appearance.items[itemGroupName] && itemName == "None") return ["NoItem"];
		
		if(itemGroupTypeName == F3dcgAssets.BODY) return ["CanNotUpdateBodyType"];
		
		if(itemGroupTypeName == F3dcgAssets.EXPRESSION){
			//expression updates are not limited
		}else if(itemGroupTypeName == F3dcgAssets.CLOTHING || itemGroupTypeName == F3dcgAssets.ACCESSORY){//clothes are limited
			//find all clothes groups that have been updated
			var clothChangedGroups = this.updateStack
					.filter(changeItem => changeItem.itemGroupTypeName == F3dcgAssets.CLOTHING || changeItem.itemGroupTypeName == F3dcgAssets.ACCESSORY)
					.map(clothOrAccessoryChangeItem => clothOrAccessoryChangeItem.itemGroupName)
					.filter((v, i, a) => a.indexOf(v) === i);
			
			//disallow any over limit clothing groups udpates.  Reupdating the old one does not add to the limit
			if(! clothChangedGroups.includes(itemGroupName) && clothChangedGroups.length >= this.clothOrAccessoryUpdateLimit) 
				return ["UpdateClothLimitExceeded"];
		}else{
			var existingRestraintOrToyUpdate = this.updateStack
					.find(changeItem => changeItem.itemGroupTypeName == F3dcgAssets.RESTRAINT || changeItem.itemGroupTypeName == F3dcgAssets.TOY);
			if(existingRestraintOrToyUpdate && existingRestraintOrToyUpdate.itemGroupName != itemGroupName) 
				return ["UpdateRestraintLimitExceeded"];
			
			var existingClothesUpdate = this.updateStack.find(changeItem => changeItem.itemGroupTypeName == F3dcgAssets.Clothes);
			if(existingClothesUpdate) return ["RestraintAndWardrobeUpdateDisabled"];
		}
		
		this.updateStack.push([appearanceItem]);
		
		F3dcgAssets.DeconvertItemAndUpdateAppearance(this.Appearance, appearanceItem);
		this.appearance = F3dcgAssets.BuildPlayerAppearance(MainController.playerAccount, this.player, this.Appearance);
		F3dcgAssets.FillInventoryValidation(MainController.playerAccount, this.player, this.inventory.items, this.appearance);
		
		return [];
	}
	
	this.Undo = function(){
		if(this.wardrobe){
		
		}else{
			if(this.updateStack.length == 0) return ["UpdateStackEmpty"]
			
			var appearanceItemToUndo = this.updateStack.pop(), appearanceItemPrev;
			
			//Find the second latest item for the item group of item to undo, and use it to update appearance
			this.updateStack.forEach(appearanceItem => {
				if(appearanceItem.itemGroupName == appearanceItemToUndo.itemGroupName)
					appearanceItemPrev = appearanceItem;//no break is intentional.
			});
			//If not found in the update stack, get one from the original player's appearance, not local copy
			if(!appearanceItemPrev) appearanceItemPrev = this.player.appearance.items[appearanceItemToUndo.itemGroupName];
			//Item not found -- meaning the slot was empty
			if(!appearanceItemPrev) appearanceItemPrev = {itemName:"None", itemGroupName:appearanceItemToUndo.itemGroupName}
			
			F3dcgAssets.DeconvertItemAndUpdateAppearance(this.Appearance, appearanceItemPrev);
			this.appearance = F3dcgAssets.BuildPlayerAppearance(MainController.playerAccount, this.player, this.Appearance);
			F3dcgAssets.FillInventoryValidation(MainController.playerAccount, this.player, this.inventory.items, this.appearance);
		}
		
		return [];
	}
	
	this.GetFinalAppItemList = function(){
		var itemsGrouped = {};//get rid of duplicates, filter only top item for each gorup
		this.updateStack.forEach(appearanceItem => {itemsGrouped[appearanceItem.itemGroupName] = F3dcgAssets.DeconvertItem(appearanceItem)});
		return Object.values(itemsGrouped);
	}
	
	
	this.GetWardrobe = function(){
		var wardrobeTypes = [F3dcgAssets.BODY, F3dcgAssets.CLOTHES, F3dcgAssets.ACCESSORIES];
		var itemsGrouped = {}
		
		this.updateStack.forEach(appearanceItem => {itemsGrouped[appearanceItem.itemGroupName] = F3dcgAssets.DeconvertItem(appearanceItem)});
		return Object.values(itemsGrouped);
	}
	
	
	
	this.Invalidate = function(){
		this.player.update = null;
		this.player = null;
	}
	this.IsValid = function(){
		return this.player?.update == this;//an update is invalidated when the player gets a new update objet;
	}
	
	
	this.HasChanges = function(){
		return this.updateStack.length > 0;
	}
	
	this.OnItemUpdate = function(){
		console.log("on item update");
	}
}

