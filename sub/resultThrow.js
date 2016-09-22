/*
    Inteded to standarize the genDB responses so they are predictable
*/
module.exports = function(){//dependancies
    var genericDBResultStatus=require('./resultModel')(),utils=require('bom-utils'),merge=require('merge'),_=require('underscore');


    /*
        new genericDBThrowResultStatus(
                resObj, //arg0 'queryObj' -> mysql query object expected - indicate a failure with false
                statusModel, //arg1 'status'
                events, //arg2 'events'
                debug //arg3 'debugBool'
        )
    */

    function genericDBThrowResultStatus(resObj, statusModel, debug){
        var expected_constructor=['Query'];
        expected_constructor.forEach(function(v,i,arr){expected_constructor[i]=v.toLowerCase()});
        this._res=(typeof(resObj)==='object' && _.indexOf(expected_constructor,resObj.constructor.name.toLowerCase())!==-1?resObj:false);
        this.status=(statusModel.constructor.name===genericDBResultStatus.name?statusModel:new genericDBResultStatus(statusModel));
        this.do_debug=(debug===true?true:false);
        if(this._res===false && typeof(resObj)==='object'){throw new Error("[genericDBThrowResultStatus] 1st argument must be 'false' (boolean) or of constructor type '"+expected_constructor.split(', ')+"'.");}
    }
    genericDBThrowResultStatus.prototype.toString=function(){
        var self=this,types='';
        self.events.forEach(function(v,i,arr){types=types+(types.length>0?', ':'')+v.type;});
        return "[genericDBThrowResultStatus] EVENTS: [ "+types+" ]"+"\n\t"+self.status.toString();
    };
    genericDBThrowResultStatus.prototype.asApply=function(){
        var self=this;
        return [self._res, self.status, self.events, self.do_debug];
    };

    return genericDBThrowResultStatus;
}
