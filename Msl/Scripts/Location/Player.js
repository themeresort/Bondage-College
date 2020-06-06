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
	
	this.UpdateAppearanceAndRender = function(appearanceUpdate){
		F3dcgAssets.UpdateAppearance(appearanceUpdate, this);
		this.render = F3dcgAssetsRender.BuildPlayerRender(this.appearance, this.currentPose);
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

//Update type is a either group type name, or 'suit'
var LocationPlayerUpdate = function(player){
	this.player = player;
	
	this.appearance = Util.CloneRecursive(player.appearance);
	this.render = Util.CloneRecursive(player.render);
	
	//this.inventory = Util.CloneRecursive(player.inventory);
	this.items = F3dcgAssetsInventory.BuildPlayerApplicableItems(MainController.playerAccount, player);
	
	//this.clothOrAccessoryUpdateLimit = 3;
	//this.clothOrAccessoryUpdateLimit = 100;//unlimited
	this.updateStack = [];
	
	this.updateRestraint = null;
	
	this.GetInventoryItem = function(groupName, itemName){
		var item = this.items[F3dcgAssets.AssetGroups[groupName].type][groupName].find(inventoryItem => inventoryItem.itemName == itemName);
		return item;
	}
	
	this.GetCurrentWornItem = function(groupName){
		var AssetGroup = F3dcgAssets.AssetGroups[groupName], item;
		switch(AssetGroup.type){
			case F3dcgAssets.CLOTH:
			case F3dcgAssets.ACCESSORY:
			case F3dcgAssets.EXPRESSION:
			case F3dcgAssets.BODY:
			case F3dcgAssets.BONDAGE_TOY:
				item = this.appearance[AssetGroup.type][groupName];
			break;
			default:
				throw "ItemGroupNotDefined " + groupName;
		}
		return item;
	}
	
	
	this.AddSuit = function(appearanceSuit){
		var update = {type:"suit", appearance:{}};
		this.updateStack.push(update);		
		
		update.appearance.frame = appearanceSuit.frame;
		this.appearance.frame = appearanceSuit.frame;
		for(var groupType in F3dcgAssets.SuitSelfTypeGroups){
			update.appearance[groupType] = Util.CloneRecursive(appearanceSuit[groupType]);
			this.appearance[groupType] = Util.CloneRecursive(appearanceSuit[groupType])
		}
		
		this.render = F3dcgAssetsRender.BuildPlayerRender(this.appearance, player.currentPose);
		
		return [];
	}
	
	
	this.AddColor = function(itemName, color){
		var groupName = F3dcgAssets.ItemNameToGroupNameMap[itemName];
		var AssetGroup = F3dcgAssets.AssetGroups[groupName];
		
		var mostRecentItemName = this.HasChanges() ? this.updateStack[this.updateStack.length - 1].item.name : this.appearance[AssetGroup.type][groupName].name;
		
		return this.Add(AssetGroup.type, groupName, mostRecentItemName, null, color.ToHexString());
	}
	
	/*
	this.AddVariant = function(itemName, variantName){
		return this.AddItem(F3dcgAssets.ItemNameToGroupNameMap[itemName], itemName);
	}*/
	
	
	this.AddItem = function(groupName, itemName){
		var AssetGroup = F3dcgAssets.AssetGroups[groupName];
		var oldItem = this.appearance[AssetGroup.type][groupName];
		var colorHexString = oldItem?.color;
		
		if(AssetGroup.type == F3dcgAssets.BONDAGE_TOY){
			if(this.updateRestraint) return ["OnlyOneBondageToyAtTime"];
			this.updateRestraint = true;
		}
		
		this.Add(AssetGroup.type, groupName, itemName, colorHexString);
		
		return [];
	}
	
	
	this.Add = function(groupTypeName, groupName, itemName, variantName, colorHexString){//Assuming validation has been taken care of elsewhere
		var newItem;
		
		console.log(groupTypeName, groupName, itemName, colorHexString);
		switch(groupTypeName){
			case F3dcgAssets.CLOTH:
				newItem = itemName == F3dcgAssetsInventory.NONE ? null : F3dcgAssets.BuildClothAppearanceItem(itemName, colorHexString);
			break;
			case F3dcgAssets.ACCESSORY:
				newItem = itemName == F3dcgAssetsInventory.NONE ? null : F3dcgAssets.BuildAccessoryAppearanceItem(itemName, colorHexString);
			break;
			case F3dcgAssets.EXPRESSION:
				newItem = F3dcgAssets.BuildExpressionAppearanceItem(itemName);
			break;
			case F3dcgAssets.BONDAGE_TOY:
				newItem = itemName == F3dcgAssetsInventory.NONE ? null : F3dcgAssets.BuildBondageToyAppearanceItem(itemName, colorHexString);
			break;
			default:
				return [AssetGroup.type + " not supported"];
		}
		
		this.appearance[groupTypeName][groupName] = newItem;
		this.updateStack.push({type:groupTypeName, groupName:groupName, item:newItem});
		this.render = F3dcgAssetsRender.BuildPlayerRender(this.appearance, player.currentPose);	
	}
	
	
	this.Undo = function(){
		if(0 == this.updateStack.length) return ["UpdateStackEmpty"];
		
		var updateToUndo = this.updateStack.pop();
		
		switch(updateToUndo.type){
			case F3dcgAssets.BONDAGE_TOY:
				this.updateRestraint = false; //no break	
			case F3dcgAssets.CLOTH:
			case F3dcgAssets.ACCESSORY:
				var itemPrev = this.GetMostRecentUpdatedItemForGroup(updateToUndo.groupName);			
				var item = itemPrev ? itemPrev : this.player.appearance[updateToUndo.type][updateToUndo.groupName];
				this.appearance[updateToUndo.type][updateToUndo.groupName] = item;				
			case F3dcgAssets.EXPRESSION:				
				var itemPrev = this.GetMostRecentUpdatedItemForGroup(updateToUndo.groupName);
				var item = itemPrev ? itemPrev : this.player.appearance[updateToUndo.type][updateToUndo.groupName];
				this.appearance[updateToUndo.type][updateToUndo.groupName] = item;						
			break;
			case "suit":
				var framePrev = this.GetMostRecentFrameUpdate();
				this.appearance.frame = framePrev ? framePrev : this.player.appearance.frame;
				
				for(var groupType in F3dcgAssets.SuitSelfTypeGroups){
					F3dcgAssets.SuitSelfTypeGroups[groupType].forEach(groupName => {
						var itemPrev = this.GetMostRecentUpdatedItemForGroup(groupName);
						var item = itemPrev ? itemPrev : this.player.appearance[groupType][groupName];
						this.appearance[groupType][groupName] = item;						
					})
				}
			break;
			
			default:console.error(updateToUndo.type);
		}
		
		this.render = F3dcgAssetsRender.BuildPlayerRender(this.appearance, player.currentPose);
		return [];
	}
	
	
	this.Invalidate = function(){
		this.player.update = null;
		this.player = null;
	}
	this.IsValid = function(){
		return this.player?.update == this;//an update is invalidated when the player gets a new update objet;
	}
	
	
	this.HasChanges = function(){
		return this.updateStack.length > 0 || this.updateRestraint;
	}
	
	
	this.GetFinalAppItemList = function(){
		var updatedGroups = {};//get rid of duplicates, filter only top item for each gorup
		this.updateStack.forEach(update => {
			switch(update.type){
				case F3dcgAssets.CLOTH:
				case F3dcgAssets.ACCESSORY:
				case F3dcgAssets.EXPRESSION:
				case F3dcgAssets.BONDAGE_TOY:
					updatedGroups[update.groupName] = update.item;
				break;
				case "suit":
					console.log(update.appearance);
					for(var groupType in F3dcgAssets.SuitSelfTypeGroups){
						F3dcgAssets.SuitSelfTypeGroups[groupType].forEach(groupName => {
							updatedGroups[groupName] = update.appearance[groupType][groupName]
						});
					}
				break;
				default: console.log(update.type);
			}
		});
		
		return updatedGroups;
	}
	
	
	this.BuildSuitFromCurrentAppearance = function(){
		var suit = {frame:{}};
		
		suit.frame = Util.CloneRecursive(this.appearance.frame);
		for(var groupType in F3dcgAssets.SuitSelfTypeGroups)
			suit[groupType] = Util.CloneRecursive(this.appearance[groupType]);
		
		return suit;
	}
	
	
	this.GetMostRecentFrameUpdate = function(){
		var mostRecentSuitFrame;
		this.updateStack.forEach(update => {
			if(update.type == "suit"){
				mostRecentSuitFrame = update.appearance.frame;
			}
		});
		return mostRecentSuitFrame;	
	}
	
	
	this.GetMostRecentUpdatedItemForGroup = function(groupName){
		var mostRecent;
		this.updateStack.forEach(update => {
			if(update.type != "suit"){
				if(update.groupName == groupName)
					mostRecent = update.item;
			}else{
				for(var groupType in F3dcgAssets.SuitSelfTypeGroups){
					F3dcgAssets.SuitSelfTypeGroups[groupType].forEach(suitGroupName => {
						if(groupName == suitGroupName){
							mostRecent = update.appearance[groupType][groupName];
						}
					});
				}
			}
		});
		return mostRecent;
	}
}


