'use strict'


var LocationController = {
	locationContainer:null
	,canvasContainer:null
	,backgroundContainer:null
	,midgroundContainer:null
	,foregroundContainer:null
	,inputContainer:null
	,hudContainer:null

	//currentActionData:null
	//,currentActionTimer:null
	//,serverTimeDiff:0
	
	,location:null//the data model
	
	,delegates:{//Each delegate implements Init, OnScreenChange, InterruptActions and UnInit
		chat:null
		,profile:null //Move this to main controller?
		,view:null	//renderer for the location
		,actions:null //renderer for action html on the location
		,focus:null
		,devTools:null
		,minigames:null
	}
	
	//constructor and destructor
	,InitAndRender(data){
		//Initialize data
		this.location = data;
		
		//replace player ids with player objects
		for(var spotName in this.location.players)
			this.location.players[spotName] = new LocationPlayer(this.location.players[spotName]);
		
		//DOM container elements
		this.locationContainer = document.getElementById("LocationView");
		this.canvasContainer = document.getElementById("LocationViewCanvas");
		this.backgroundContainer = document.getElementById("LocationViewBackground");
		this.midgroundContainer = document.getElementById("LocationViewMidground");
		this.foregroundContainer = document.getElementById("LocationViewForeground");
		this.inputContainer = document.getElementById("LocationViewInput");
		this.hudContainer = document.getElementById("LocationViewHud");
		
		//Delegates Order is important
		this.delegates.chat = LocationViewChat;
		this.delegates.profile = ProfileManagement;
		this.delegates.view = LocationView;	
		this.delegates.actions = LocationActions;
		this.delegates.focus = LocationFocusView;
		this.delegates.devTools = DevTools;
		this.delegates.minigames = LocationMinigames;
		
		LocationController.locationContainer.style.display = "block";
		Object.values(this.delegates).forEach(delegate => {delegate?.Init()});
		
		ClassicHud.RollForward();
	}
	
	,UnInit(){
		LocationController.location = null;
		LocationController.locationContainer.style.display = "none";
		Object.values(this.delegates).forEach(delegate => delegate?.UnInit());
	}
	
	//Getters
	,GetSpot(spotName){
		return spotName ? LocationController.location.spots[spotName] : LocationController.GetSpotWithPlayer(MainController.playerAccount.id);
	}
	
	,GetSpotWithPlayer(playerId){
		for(var spotName in LocationController.location.players)
			if(LocationController.location.players[spotName].id == playerId)
				return LocationController.location.spots[spotName];
	}
	
	,GetPlayer(playerIdOrSpotName){
		if(typeof(playerIdOrSpotName) == "undefined")
			playerIdOrSpotName = MainController.playerAccount.id;
		
		var playerId = parseInt(playerIdOrSpotName);
		if(!playerId) return LocationController.location.players[playerIdOrSpotName];
		
		for(var spotName in LocationController.location.players)
			if(LocationController.location.players[spotName].id == playerId)
				return LocationController.location.players[spotName];
	}
	
	//Other private methods
	,InterruptDelegateActions(){
		Object.values(LocationController.delegates).forEach(delegate => delegate?.Interrupt());
	}
	
	//Show actions or popups
	,ShowMoveActions(){
		LocationController.InterruptDelegateActions();
		LocationController.delegates.actions.ShowActionsMove();
	}
	
	
	,StartPlayerFocus(player){
		LocationController.InterruptDelegateActions();
		LocationController.delegates.focus.Focus(player ? player : LocationController.GetPlayer());
	}
	
	
	,ShowPlayerProfile(player){
		//console.log(player);
		LocationController.InterruptDelegateActions();
		LocationController.delegates.profile.ShowProfile(player ? player : LocationController.GetPlayer());
	}
	
	/*
	,IsActionInProgress(){
		return currentActionData && ! currentActionData.finished;
	}*/
	
	/*
	,GetActionsForSpot(spot){
		var actions = {
			spotInfo:function(){LocationController.SpotInfo(spot.name);} //instant resposne to origin only
			,moveToSpot:false		//one challenge response
			,exitLocation:false		//instance response, update everyone
			,AppearanceUpdate:false			//challenge to target, challenge to origin, challenge to target
		};
		
		if(spot.name == LocationController.currentSpotName){//actions for this player
			if(spot.entrance)	actions.exitLocation = MainController.ExitLocation;
			
			actions.AppearanceUpdateSelf = LocationController.AppearanceUpdateSelf;
			actions.poseChangeSelf = LocationController.PoseChangeSelf;
		}else{
			if(! spot.player){//actions for other player
				var connection =  LocationController.currentScreen.spots[LocationController.currentSpotName].connections.find(el => el.targetName == spot.name);
				if(connection)	actions.moveToSpot = () => LocationController.MoveToSpot(spot.name);
			}else{//actions for 
				actions.AppearanceUpdate = () => LocationController.AppearanceUpdate(spot.name, spot.player.id);
			}
		}
		
		return actions;
	}
	*/
	
	/*
	,PoseChangeSelf(){
		var player = this.GetPlayer();
		if(! F3dcgAssets.ValidateChangePoseSelf(player)) return;
		player.kneelingActive = ! player.kneelingActive;
		LocationController.viewDelegate.RenderPlayerInSpot(this.GetCurrentSpot());	
	}*/
	
	//Actions, that update server state
	,ExitLocation(){MainController.ExitLocation();}
	
	
	,UpdatePlayerProfile(profileData){
		MslServer.UpdatePlayerProfile(profileData);
		LocationController.InterruptDelegateActions();
	}

	,UpdatePlayer(playerUpdate){
		if(! playerUpdate?.IsValid()) throw "ChangeWasInvalidated";
		if(playerUpdate.player.id == MainController.playerAccount.id){
			var appearanceUpdate = playerUpdate.GetFinalAppItemList();
			MslServer.ActionStart({type:"AppearanceUpdateSelf", appearanceUpdate:appearanceUpdate});
		}else
			MslServer.ActionStart({type:"AppearanceUpdateOther", targetPlayerId:playerUpdate.player.id, appearanceUpdate:playerUpdate.GetFinalAppItemList()});
		
		LocationController.InterruptDelegateActions();
	}
	
	//,SpotInfo(spotName){MslServer.ActionStart({type:"SpotInfo", originSpotName:LocationController.currentSpotName, targetSpotName:spotName});}
	,MoveToSpot(spotName){
		MslServer.ActionStart({type:"MoveToSpot", originSpotName:LocationController.GetSpot().name, targetSpotName:spotName});
	}
	
	,SendChatMessage(content){
		MslServer.ActionStart({type:"ChatMessage", content:content});
	}
	
	
	//Server replies to actions
	,PlayerExitLocationResp(data){
		console.log("PlayerExitLocationResp");
		console.log(data);
		
		var spot = LocationController.GetSpotWithPlayer(data.playerId);
		if(! spot) 	throw "PlayerNotFound " + data.playerId;
		
		delete LocationController.location.players[spot.name]
		LocationController.delegates.view.OnPlayerExit(spot.name);
		LocationController.delegates.chat.OnPlayerExit(spot.name);
	}
	
	
	,PlayerEnterLocationResp(data){
		console.log("PlayerEnterLocationResp");
		console.log(data);
		
		var existingPlayer = LocationController.GetPlayer(data.player.id);
		if(! existingPlayer){
			var player = new LocationPlayer(data.player);
			LocationController.location.players[data.spotName] = player
			LocationController.delegates.view.RenderPlayerInSpot(data.spotName, player);
			LocationController.delegates.chat.OnPlayerEnter(player);
		}else if(existingPlayer.id == data.player.id){
			console.log("player reconnected");
			LocationController.delegates.chat.OnPlayerReconnect(data.player.id);
		}else{
			console.log("mismatch detected, update whole thing");
		}
	}
	
	
	,LocationActionResp(data){
		console.log("LocationActionResp"); 
		console.log(data);
		LocationController["LocationAction_" + data.type](data);
		LocationController.delegates.chat.OnAction(data);
	}
	
	
	,LocationAction_ChatMessage(data){
		//already takecn care of earlier
		
	}
	
	
	,LocationAction_SpotInfo(data){
		console.log("Spot info not implemented");
	}
	
	
	,LocationAction_MoveToSpot(action){
		var Move = function(playerId, originSpotName, targetSpotName){
			var player  = LocationController.GetPlayer(playerId);
			var originSpot = LocationController.GetSpotWithPlayer(playerId), targetSpot = LocationController.location.spots[targetSpotName];
			if(! originSpot.name == action.originSpotName) throw "MismatchedOrigin " + originSpot.name + " " + action.originSpotName;
			if(LocationController.location.players[action.targetSpotName]) throw "SpotOccupied " + action.targetSpotName;		
			LocationController.location.players[targetSpotName] = LocationController.location.players[originSpotName];
			delete LocationController.location.players[originSpotName];
			
			if(player.id == MainController.playerAccount.id	&& originSpot.screens.Default != targetSpot.screens.Default){
				Object.values(LocationController.delegates).forEach(delegate => {delegate?.OnScreenChange()});		
			}else{
				LocationController.delegates.view.OnPlayerMove(player, originSpotName, targetSpotName);
			}
		}
		
		if(action.originPlayerId == MainController.playerAccount.id){//self action
			if(! action.finished){//minigame
				LocationController.currentAction = action;
				LocationController.delegates.minigames.StartMinigame(action.challenge, (result) => {result.id=action.id; MslServer.ActionProgress(result);});
			}else if(action.success){//finished
				Move(action.originPlayerId, action.originSpotName, action.targetSpotName)				
				//LocationController.currentAction.finished = true;
			}else{
				throw action;
			}
		}else{//other action
			if(! action.finished){
				console.log("" + action.originPlayerId + " started moving from " + action.originSpotName + " to " + action.targetSpotName);
			}else{
				console.log("" + action.originPlayerId + " finished moving from " + action.originSpotName + " to " + action.targetSpotName);
				Move(action.originPlayerId, action.originSpotName, action.targetSpotName)
			}
		}
	}
	
	
	,LocationAction_AppearanceUpdateOther(action){
		var player = this.GetPlayer(action.targetPlayerId);
		player.UpdateApearance(action.result);
		LocationController.delegates.view.RenderPlayerInSpot(this.GetSpotWithPlayer(player.id).name, player);
	}
	
	
	,LocationAction_AppearanceUpdateSelf(action){
		var player = this.GetPlayer(action.targetPlayerId);
		player.UpdateAppearanceAndRender(action.result);
		LocationController.delegates.view.RenderPlayerInSpot(this.GetSpotWithPlayer(player.id).name, player);
	}
}
